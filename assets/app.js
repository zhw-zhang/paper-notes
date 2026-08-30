(() => {
  const data = window.PAPER_NOTES_DATA || { generated_at: "", build_mode: "public", papers: [] };
  const state = { query: "", tag: "全部", sort: "created", activePaper: null };
  const repositoryUrl = "https://github.com/zhw-zhang/paper-notes";
  const fullscreenSessionKey = "paper-notes-fullscreen-paper";
  const scrollSessionKey = "paper-notes-reader-scroll";
  let lockedScrollY = 0;
  let toastTimer = null;
  let authorMenuCloseTimer = null;
  let tocScrollFrame = null;
  let tocSectionIds = [];
  let activeTocId = "";

  const elements = {
    grid: document.querySelector("#paper-grid"),
    tags: document.querySelector("#tag-list"),
    search: document.querySelector("#search-input"),
    sort: document.querySelector("#sort-select"),
    count: document.querySelector("#result-count"),
    empty: document.querySelector("#empty-state"),
    dialog: document.querySelector("#paper-dialog"),
    dialogContent: document.querySelector("#dialog-content"),
    fullscreen: document.querySelector("#reader-fullscreen"),
    readerTheme: document.querySelector("#reader-theme-toggle"),
    copyLink: document.querySelector("#reader-copy-link"),
    copyCitation: document.querySelector("#reader-copy-citation"),
    downloadMarkdown: document.querySelector("#reader-download-markdown"),
    editNote: document.querySelector("#reader-edit-note"),
    newNote: document.querySelector("#new-note-link"),
    authorMenu: document.querySelector(".author-menu"),
    print: document.querySelector("#reader-print"),
    desktopToc: document.querySelector("#desktop-toc"),
    mobileToc: document.querySelector("#mobile-toc"),
    mobileTocBody: document.querySelector("#mobile-toc-body"),
    toast: document.querySelector("#reader-toast"),
    imageDialog: document.querySelector("#image-dialog"),
    imageDialogImage: document.querySelector("#image-dialog-image"),
    imageDialogCaption: document.querySelector("#image-dialog-caption"),
  };

  const CALLOUT_LABELS = {
      NOTE: "补充",
      TIP: "建议",
      IMPORTANT: "关键判断",
      WARNING: "发布提醒",
      CAUTION: "高风险边界",
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function safeLink(url, label, className = "") {
    if (!url) return escapeHtml(label);
    return `<a${className ? ` class="${className}"` : ""} href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)} ↗</a>`;
  }

  function readingMinutes(markdown = "") {
    const plainText = String(markdown)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#>*_`~$\\{}\[\]()|:-]/g, " ");
    const chineseCharacters = (plainText.match(/[\u3400-\u9fff]/g) || []).length;
    const latinWords = (plainText.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
    return Math.max(1, Math.ceil(chineseCharacters / 350 + latinWords / 220));
  }

  function paperReadingMinutes(paper = {}) {
    const builtMinutes = Number(paper.reading_minutes);
    return Number.isFinite(builtMinutes) && builtMinutes > 0
      ? Math.ceil(builtMinutes)
      : readingMinutes(paper.body);
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[([^\]]+)\]\((#section-\d+)\)/g, '<a href="$2">$1</a>');
  }

  function renderCallout(type, lines) {
    const blocks = lines.join("\n").split(/\n\s*\n/).filter((item) => item.trim());
    const rendered = [];
    let listItems = [];
    const flushList = () => {
      if (!listItems.length) return;
      rendered.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      listItems = [];
    };
    blocks.forEach((block) => {
      const blockLines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (blockLines.length && blockLines.every((line) => /^[-*]\s+/.test(line))) {
        listItems.push(...blockLines.map((line) => line.replace(/^[-*]\s+/, "")));
        return;
      }
      flushList();
      rendered.push(`<p>${inlineMarkdown(blockLines.join(" "))}</p>`);
    });
    flushList();
    const body = rendered.join("");
    return `<aside class="callout callout-${type.toLowerCase()}" aria-label="${CALLOUT_LABELS[type]}">
      <div class="callout-content">${body}</div>
    </aside>`;
  }

  function renderBlockquote(quoteLines) {
    const blocks = quoteLines.join("\n").split(/\n\s*\n/).filter((item) => item.trim());
    const rendered = [];
    let listItems = [];
    const flushList = () => {
      if (!listItems.length) return;
      rendered.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      listItems = [];
    };
    blocks.forEach((block) => {
      const blockLines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (blockLines.length && blockLines.every((line) => /^[-*]\s+/.test(line))) {
        listItems.push(...blockLines.map((line) => line.replace(/^[-*]\s+/, "")));
        return;
      }
      flushList();
      rendered.push(`<p>${inlineMarkdown(blockLines.join(" "))}</p>`);
    });
    flushList();
    return `<blockquote>${rendered.join("")}</blockquote>`;
  }

  function renderMarkdown(markdown = "", accentHeadings = []) {
    const lines = markdown.replace(/\r/g, "").split("\n");
    const output = [];
    const toc = [];
    let listType = null;
    let displayMath = null;
    let displayMathStyle = "";
    let codeBlock = null;
    let codeLanguage = "";
    let headingIndex = 0;
    const closeList = () => { if (listType) output.push(`</${listType}>`); listType = null; };
    const parseTableRow = (value) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    const isTableDivider = (value) => {
      const cells = parseTableRow(value);
      return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
    };
    const parseListItem = (value) => {
      const match = value.match(/^([ \t]*)([-*]|\d+[.)]|[a-z]\))\s+(.+)$/i);
      if (!match) return null;
      const marker = match[2];
      const kind = /^[-*]$/.test(marker) ? "ul" : /^[a-z]\)$/i.test(marker) ? "alpha" : "ol";
      const order = kind === "ul"
        ? null
        : kind === "alpha"
          ? marker.toLowerCase().charCodeAt(0) - 96
          : Number.parseInt(marker, 10);
      return {
        indent: match[1].replace(/\t/g, "    ").length,
        kind,
        order,
        text: match[3],
      };
    };
    const renderListLevel = (items, startIndex, indent, kind) => {
      const tag = kind === "ul" ? "ul" : "ol";
      const typeAttribute = kind === "alpha" ? ' type="a"' : "";
      let html = `<${tag}${typeAttribute}>`;
      let itemIndex = startIndex;
      while (itemIndex < items.length) {
        const item = items[itemIndex];
        if (item.indent !== indent || item.kind !== kind) break;
        const valueAttribute = tag === "ol" && item.order ? ` value="${item.order}"` : "";
        html += `<li${valueAttribute}>${inlineMarkdown(item.text)}`;
        itemIndex += 1;
        while (itemIndex < items.length && items[itemIndex].indent > indent) {
          const nested = renderListLevel(
            items,
            itemIndex,
            items[itemIndex].indent,
            items[itemIndex].kind,
          );
          html += nested.html;
          itemIndex = nested.nextIndex;
        }
        html += "</li>";
      }
      html += `</${tag}>`;
      return { html, nextIndex: itemIndex };
    };
    const renderListBlock = (items) => {
      let html = "";
      let itemIndex = 0;
      while (itemIndex < items.length) {
        const rendered = renderListLevel(
          items,
          itemIndex,
          items[itemIndex].indent,
          items[itemIndex].kind,
        );
        html += rendered.html;
        itemIndex = rendered.nextIndex;
      }
      return html;
    };

    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index];
      const line = raw.trim();
      if (codeBlock !== null) {
        if (line === "```") {
          const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
          output.push(`<pre class="code-block"><code${languageClass}>${escapeHtml(codeBlock.join("\n"))}</code></pre>`);
          codeBlock = null;
          codeLanguage = "";
        } else {
          codeBlock.push(raw);
        }
        continue;
      }
      if (line.startsWith("```")) {
        closeList();
        codeBlock = [];
        codeLanguage = line.slice(3).trim().replace(/[^a-z0-9_-]/gi, "");
        continue;
      }
      if (displayMath !== null) {
        displayMath.push(raw);
        if (line.endsWith("$$")) {
          const mathClass = displayMathStyle === "boxed" ? " math-boxed" : "";
          output.push(`<div class="math-block${mathClass}">${escapeHtml(displayMath.join("\n"))}</div>`);
          displayMath = null;
          displayMathStyle = "";
        }
        continue;
      }
      if (line.startsWith("$$")) {
        closeList();
        const styledMath = line.match(/^\$\$\s+\{\.(plain|boxed)\}\s*$/);
        if (styledMath) {
          displayMath = ["$$"];
          displayMathStyle = styledMath[1];
          continue;
        }
        if (line.length > 2 && line.endsWith("$$")) output.push(`<div class="math-block">${escapeHtml(line)}</div>`);
        else { displayMath = [raw]; displayMathStyle = ""; }
        continue;
      }
      if (!line) { closeList(); continue; }

      const callout = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/);
      if (callout) {
        closeList();
        const calloutLines = callout[2] ? [callout[2]] : [];
        while (index + 1 < lines.length && lines[index + 1].trim().startsWith(">")) {
          index += 1;
          calloutLines.push(lines[index].trim().replace(/^>\s?/, ""));
        }
        output.push(renderCallout(callout[1], calloutLines));
        continue;
      }

      const image = line.match(/^!\[([^\]]+)\]\((media\/[^\s)"']+\.(?:png|jpe?g|webp))(?:\s+"([^"]+)")?\)(?:\{\.(narrow|scale85|scale90)\})?$/i);
      if (image) {
        closeList();
        const altText = image[1];
        const imagePath = image[2];
        const caption = image[3] || "";
        const figureStyle = image[4];
        const figureClass = figureStyle ? `paper-figure paper-figure-${figureStyle}` : "paper-figure";
        output.push(`<figure class="${figureClass}">
          <button class="paper-image-button" type="button" data-image-src="${escapeHtml(imagePath)}" data-image-alt="${escapeHtml(altText)}" data-image-caption="${escapeHtml(caption)}" aria-label="放大查看：${escapeHtml(altText)}">
            <img src="${escapeHtml(imagePath)}" alt="${escapeHtml(altText)}" loading="lazy" decoding="async" />
          </button>
          ${caption ? `<figcaption>${inlineMarkdown(caption)}</figcaption>` : ""}
        </figure>`);
        continue;
      }

      if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
        closeList();
        const headers = parseTableRow(line);
        const alignments = parseTableRow(lines[index + 1]).map((cell) => {
          if (cell.startsWith(":") && cell.endsWith(":")) return "center";
          if (cell.endsWith(":")) return "right";
          return "left";
        });
        const rows = [];
        index += 2;
        while (index < lines.length && lines[index].trim().includes("|")) {
          rows.push(parseTableRow(lines[index]));
          index += 1;
        }
        index -= 1;
        const headerHtml = headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("");
        const bodyHtml = rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td style="text-align:${alignments[cellIndex] || "left"}">${inlineMarkdown(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("");
        output.push(`<div class="table-scroll"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`);
        continue;
      }

      const heading = line.match(/^(##|###)\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        headingIndex += 1;
        const id = `section-${headingIndex}`;
        toc.push({ id, level, label: heading[2] });
        const accentClass = level === 2 && accentHeadings.includes(heading[2]) ? ' class="section-accent"' : "";
        output.push(`<h${level}${accentClass} id="${id}">${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const firstListItem = parseListItem(raw);
      if (firstListItem) {
        closeList();
        const listItems = [firstListItem];
        while (index + 1 < lines.length) {
          const nextListItem = parseListItem(lines[index + 1]);
          if (!nextListItem) break;
          index += 1;
          listItems.push(nextListItem);
        }
        output.push(renderListBlock(listItems));
        continue;
      }

      closeList();
      if (line.startsWith(">")) {
        const quoteLines = [line.replace(/^>\s?/, "")];
        while (index + 1 < lines.length && lines[index + 1].trim().startsWith(">")) {
          index += 1;
          quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        }
        output.push(renderBlockquote(quoteLines));
        continue;
      }
      output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
    if (codeBlock !== null) output.push(`<pre class="math-error">${escapeHtml(codeBlock.join("\n"))}</pre>`);
    if (displayMath !== null) output.push(`<pre class="math-error">${escapeHtml(displayMath.join("\n"))}</pre>`);
    closeList();
    return { html: output.join(""), toc };
  }

  function renderMath(container) {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\begin{equation}", right: "\\end{equation}", display: true },
        { left: "\\begin{align}", right: "\\end{align}", display: true },
        { left: "\\begin{gather}", right: "\\end{gather}", display: true },
      ],
      throwOnError: false,
      strict: "warn",
    });
  }

  function formatDate(value) {
    if (!value) return "日期未知";
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" })
      .format(new Date(`${value}T00:00:00`));
  }

  function formatCardDate(value) {
    return value ? String(value).slice(0, 10) : "—";
  }

  function localTimestamp(date) {
    const pad = (value) => String(value).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? "+" : "-";
    const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
    const offsetRemainder = pad(Math.abs(offsetMinutes) % 60);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      + `${offsetSign}${offsetHours}:${offsetRemainder}`;
  }

  function configureNewNoteLink() {
    if (!elements.newNote) return;
    const now = new Date();
    const date = localTimestamp(now).slice(0, 10);
    const filename = `${date}-new-paper-note.md`;
    const timestamp = localTimestamp(now);
    const sourceUrl = `${repositoryUrl}/blob/main/content/papers/${filename}`;
    const template = `---
title: "待填写：论文标题"
paper_url: ""
authors: "待填写"
venue: "待填写"
published: "${now.getFullYear()}"
read_date: "${date}"
read_at: "${timestamp}"
created_at: "${timestamp}"
updated_at: "${timestamp}"
status: "待整理"
tags: ["待分类"]
one_liner: "待填写：半年后仍值得记住的核心机制。"
paper_license: "未明确开放许可"
paper_license_url: ""
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "${sourceUrl}"
sharing: "public"
accent_headings: []
---

## 研究问题

待填写。

## 核心方法

待填写。

## 关键发现

待填写。

## 我的提问

待填写。

## 局限与疑问

待填写。

## 我的判断

待填写。

## 下次只看这些

1. 待填写。
`;
    const parameters = new URLSearchParams({ filename, value: template });
    elements.newNote.href = `${repositoryUrl}/new/main/content/papers?${parameters.toString()}`;
  }

  function initAuthorMenu() {
    if (!elements.authorMenu) return;
    const supportsHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cancelClose = () => clearTimeout(authorMenuCloseTimer);
    const closeMenu = () => {
      clearTimeout(authorMenuCloseTimer);
      elements.authorMenu.open = false;
    };

    if (supportsHover) {
      elements.authorMenu.addEventListener("pointerenter", cancelClose);
      elements.authorMenu.addEventListener("pointerleave", () => {
        clearTimeout(authorMenuCloseTimer);
        authorMenuCloseTimer = setTimeout(closeMenu, 180);
      });
    }

    document.addEventListener("click", (event) => {
      if (elements.authorMenu.open && !elements.authorMenu.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.authorMenu.open) closeMenu();
    });
  }

  function githubEditUrl(sourcePath) {
    if (!sourcePath || !sourcePath.startsWith("content/papers/")) return "";
    const encodedPath = sourcePath.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${repositoryUrl}/edit/main/${encodedPath}`;
  }

  function citationFor(paper) {
    const publication = [paper.venue, paper.published].filter(Boolean).join(", ");
    return `${paper.authors}. “${paper.title}.”${publication ? ` ${publication}.` : ""}${paper.paper_url ? ` ${paper.paper_url}` : ""}`;
  }

  function rightsMarkup(paper) {
    const license = safeLink(paper.paper_license_url, paper.paper_license);
    const source = paper.paper_url
      ? safeLink(paper.paper_url, "原文")
      : "原创内容";
    const noteSource = paper.note_source_url ? safeLink(paper.note_source_url, "Markdown") : "本地笔记";
    const media = paper.media && paper.media.length ? ` · 图片来源见图注` : " · 未转载论文图片";
    const paperLicense = paper.paper_url ? ` · 论文 ${license}` : "";
    return `<p class="rights-line" aria-label="来源与许可">${source}${paperLicense} · 笔记 © ${escapeHtml((paper.read_date || "2026").slice(0, 4))} ${escapeHtml(paper.note_author)}, ${escapeHtml(paper.note_license)} · ${noteSource}${media}</p>`;
  }

  function tocMarkup(toc) {
    if (!toc.length) return "<p class=\"toc-empty\">本文没有章节标题。</p>";
    return toc.map((item) => `<button class="toc-link toc-level-${item.level}" type="button" data-target="${item.id}">${escapeHtml(item.label)}</button>`).join("");
  }

  function setActiveToc(targetId, keepVisible = true) {
    if (!targetId) return;
    if (targetId !== activeTocId) {
      activeTocId = targetId;
      [...elements.desktopToc.querySelectorAll(".toc-link"), ...elements.mobileTocBody.querySelectorAll(".toc-link")]
        .forEach((button) => {
          const active = button.dataset.target === targetId;
          button.classList.toggle("active", active);
          if (active) button.setAttribute("aria-current", "location");
          else button.removeAttribute("aria-current");
        });
    }

    if (!keepVisible || !elements.dialog.classList.contains("reader-fullscreen")) return;
    const activeLink = [...elements.desktopToc.querySelectorAll(".toc-link")]
      .find((button) => button.dataset.target === targetId);
    const panel = activeLink?.closest(".desktop-toc-panel");
    if (!activeLink || !panel) return;
    const linkRect = activeLink.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    if (linkRect.top < panelRect.top + 14) panel.scrollTop -= panelRect.top + 14 - linkRect.top;
    else if (linkRect.bottom > panelRect.bottom - 18) panel.scrollTop += linkRect.bottom - panelRect.bottom + 18;
  }

  function updateActiveToc() {
    tocScrollFrame = null;
    if (!elements.dialog.open || !tocSectionIds.length) return;
    const toolbar = elements.dialog.querySelector(".reader-toolbar");
    const dialogTop = elements.dialog.getBoundingClientRect().top;
    const readingLine = dialogTop + (toolbar?.getBoundingClientRect().height || 64) + 74;
    let currentId = tocSectionIds[0];
    tocSectionIds.forEach((sectionId) => {
      const heading = elements.dialogContent.querySelector(`#${sectionId}`);
      if (heading && heading.getBoundingClientRect().top <= readingLine) currentId = sectionId;
    });
    if (elements.dialog.scrollTop + elements.dialog.clientHeight >= elements.dialog.scrollHeight - 8) {
      currentId = tocSectionIds[tocSectionIds.length - 1];
    }
    setActiveToc(currentId);
  }

  function scheduleActiveToc() {
    if (tocScrollFrame !== null) return;
    tocScrollFrame = requestAnimationFrame(updateActiveToc);
  }

  function syncDialogScrollLock() {
    const root = document.documentElement;
    const body = document.body;
    const shouldLock = elements.dialog.open || elements.imageDialog.open;
    const isLocked = root.classList.contains("dialog-open");
    if (shouldLock && !isLocked) {
      lockedScrollY = window.scrollY;
      root.classList.add("dialog-open");
      body.style.top = `-${lockedScrollY}px`;
      return;
    }
    if (!shouldLock && isLocked) {
      root.classList.add("restoring-scroll");
      root.classList.remove("dialog-open");
      body.style.removeProperty("top");
      window.scrollTo(0, lockedScrollY);
      requestAnimationFrame(() => root.classList.remove("restoring-scroll"));
    }
  }

  function allTags() {
    const counts = new Map();
    data.papers.forEach((paper) => paper.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function renderTags() {
    const tags = [["全部", data.papers.length], ...allTags()];
    elements.tags.innerHTML = tags.map(([tag, count]) => `
      <button class="tag-button ${state.tag === tag ? "active" : ""}" type="button" data-tag="${escapeHtml(tag)}">
        ${escapeHtml(tag)} · ${count}
      </button>`).join("");
    elements.tags.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      state.tag = button.dataset.tag;
      renderTags();
      renderPapers();
    }));
  }

  function filteredPapers() {
    const needle = state.query.trim().toLocaleLowerCase();
    const filtered = data.papers.filter((paper) => {
      const tagMatch = state.tag === "全部" || paper.tags.includes(state.tag);
      const haystack = [paper.title, paper.authors, paper.venue, paper.one_liner, paper.body, paper.paper_license, ...paper.tags].join(" ").toLocaleLowerCase();
      return tagMatch && (!needle || haystack.includes(needle));
    });
    return filtered.sort((a, b) => {
      if (state.sort === "title") return a.title.localeCompare(b.title);
      if (state.sort === "updated") {
        return (b.updated_at || b.read_at || "").localeCompare(a.updated_at || a.read_at || "")
          || a.title.localeCompare(b.title);
      }
      if (state.sort === "created") {
        return (b.created_at || b.read_at || "").localeCompare(a.created_at || a.read_at || "")
          || a.title.localeCompare(b.title);
      }
      return b.read_date.localeCompare(a.read_date)
        || (b.read_at || "").localeCompare(a.read_at || "")
        || a.title.localeCompare(b.title);
    });
  }

  function paperCard(paper) {
    const tags = paper.tags.slice(0, 3).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
    const authorNames = paper.authors.split(",").map((name) => name.trim()).filter(Boolean);
    const cardAuthors = authorNames.length > 2 ? `${authorNames[0]} et al.` : paper.authors;
    const minutes = paperReadingMinutes(paper);
    const updatedDate = formatCardDate(paper.updated_at || paper.created_at || paper.read_date);
    return `<article class="paper-card">
      <button class="card-button" type="button" data-slug="${escapeHtml(paper.slug)}" aria-label="打开《${escapeHtml(paper.title)}》详情">
        <div class="card-top"><span class="status">${escapeHtml(paper.status)}</span><span class="card-top-meta"><span>${minutes} min</span><span aria-hidden="true">·</span><span>${formatCardDate(paper.read_date)}</span></span></div>
        <h3>${escapeHtml(paper.title)}</h3>
        <p class="authors">${escapeHtml(cardAuthors)}${paper.venue ? ` · ${escapeHtml(paper.venue)}` : ""}</p>
        <p class="one-liner">${escapeHtml(paper.one_liner)}</p>
        <div class="card-bottom"><span class="card-updated">Last updated ${updatedDate}</span><div class="card-tags">${tags}</div><span class="arrow" aria-hidden="true">↗</span></div>
      </button>
    </article>`;
  }

  function renderPapers() {
    const papers = filteredPapers();
    elements.grid.innerHTML = papers.map(paperCard).join("");
    elements.count.textContent = `显示 ${papers.length} / ${data.papers.length} 篇记录`;
    elements.empty.hidden = papers.length !== 0;
    elements.grid.hidden = papers.length === 0;
    elements.grid.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => openPaper(button.dataset.slug)));
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 1800);
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(successMessage);
  }

  function savedFullscreenPaper() {
    try { return sessionStorage.getItem(fullscreenSessionKey) || ""; }
    catch (_error) { return ""; }
  }

  function savedReaderScroll(slug) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(scrollSessionKey) || "null");
      return saved?.slug === slug ? Math.max(0, Number(saved.scrollTop) || 0) : 0;
    } catch (_error) { return 0; }
  }

  function saveReaderScroll() {
    if (!state.activePaper || !elements.dialog.open) return;
    try {
      sessionStorage.setItem(scrollSessionKey, JSON.stringify({
        slug: state.activePaper.slug,
        scrollTop: elements.dialog.scrollTop,
      }));
    } catch (_error) {}
  }

  function clearReaderScroll() {
    try { sessionStorage.removeItem(scrollSessionKey); }
    catch (_error) {}
  }

  function setFullscreen(enabled, remember = true) {
    elements.dialog.classList.toggle("reader-fullscreen", enabled);
    elements.fullscreen.textContent = enabled ? "退出全窗口" : "全窗口阅读";
    elements.fullscreen.setAttribute("aria-pressed", String(enabled));
    elements.mobileToc.open = false;
    if (remember) {
      try {
        if (enabled && state.activePaper) sessionStorage.setItem(fullscreenSessionKey, state.activePaper.slug);
        else sessionStorage.removeItem(fullscreenSessionKey);
      } catch (_error) {}
    }
    scheduleActiveToc();
  }

  function openPaper(slug, updateHash = true) {
    const paper = data.papers.find((item) => item.slug === slug);
    if (!paper) return;
    const restoreFullscreen = savedFullscreenPaper() === slug;
    const restoreScrollTop = savedReaderScroll(slug);
    const minutes = paperReadingMinutes(paper);
    state.activePaper = paper;
    setFullscreen(false, false);
    const rendered = renderMarkdown(paper.body, Array.isArray(paper.accent_headings) ? paper.accent_headings : []);
    elements.dialogContent.innerHTML = `
      <p class="detail-kicker">${escapeHtml(paper.status)} · ${formatDate(paper.read_date)}</p>
      <h1 id="dialog-title">${escapeHtml(paper.title)}</h1>
      <div class="detail-meta"><span>${escapeHtml(paper.authors)}</span><span>${escapeHtml(paper.venue)}</span><span>${escapeHtml(paper.published)}</span><span class="reading-time">约 ${minutes} 分钟阅读</span></div>
      <p class="detail-summary">“${escapeHtml(paper.one_liner)}”</p>
      <div class="detail-body">${rendered.html}</div>
      ${rightsMarkup(paper)}`;
    const toc = tocMarkup(rendered.toc);
    tocSectionIds = rendered.toc.map((item) => item.id);
    activeTocId = "";
    elements.desktopToc.innerHTML = toc;
    elements.mobileTocBody.innerHTML = toc;
    elements.downloadMarkdown.href = `notes/${encodeURIComponent(paper.source_file)}`;
    elements.downloadMarkdown.download = paper.source_file;
    const editUrl = githubEditUrl(paper.source_path);
    elements.editNote.hidden = !editUrl;
    elements.editNote.href = editUrl || "#";
    renderMath(elements.dialogContent);
    if (!elements.dialog.open) elements.dialog.showModal();
    setFullscreen(restoreFullscreen, false);
    syncDialogScrollLock();
    requestAnimationFrame(() => {
      elements.dialog.scrollTop = restoreScrollTop;
      updateActiveToc();
    });
    if (updateHash) history.pushState({ slug }, "", `#paper=${encodeURIComponent(slug)}`);
  }

  function closePaper(updateHash = true) {
    if (elements.dialog.open) elements.dialog.close();
    if (updateHash && location.hash.startsWith("#paper=")) history.pushState({}, "", location.pathname + location.search);
  }

  function openImage(button) {
    elements.imageDialogImage.src = button.dataset.imageSrc;
    elements.imageDialogImage.alt = button.dataset.imageAlt || "论文图片";
    elements.imageDialogCaption.textContent = button.dataset.imageCaption || "";
    elements.imageDialogCaption.hidden = !button.dataset.imageCaption;
    elements.imageDialog.showModal();
    syncDialogScrollLock();
  }

  function openFromHash() {
    const match = location.hash.match(/^#paper=(.+)$/);
    if (match) openPaper(decodeURIComponent(match[1]), false);
    else closePaper(false);
  }

  function scrollToSection(event) {
    const button = event.target.closest("[data-target]");
    if (!button) return;
    const target = elements.dialogContent.querySelector(`#${button.dataset.target}`);
    if (target) {
      setActiveToc(button.dataset.target, false);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      scheduleActiveToc();
    }
    elements.mobileToc.open = false;
  }

  function printPaper() {
    if (!state.activePaper) return;
    const previousTitle = document.title;
    document.title = `${state.activePaper.title} · Paper Notes`;
    const restoreTitle = () => { document.title = previousTitle; removeEventListener("afterprint", restoreTitle); };
    addEventListener("afterprint", restoreTitle);
    window.print();
  }

  function initStats() {
    const uniqueDays = new Set(data.papers.map((paper) => paper.read_date)).size;
    document.querySelector("#stat-papers").textContent = data.papers.length;
    document.querySelector("#stat-tags").textContent = allTags().length;
    document.querySelector("#stat-days").textContent = uniqueDays;
    document.querySelector("#last-updated").textContent = data.generated_at ? `Last sync ${formatDate(data.generated_at.slice(0, 10))}` : "";
  }

  function initTheme() {
    const saved = localStorage.getItem("paper-notes-theme") || localStorage.getItem("paper-recap-theme");
    const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = saved || preferred;
    const toggleTheme = () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("paper-notes-theme", next);
    };
    document.querySelector("#theme-toggle").addEventListener("click", toggleTheme);
    elements.readerTheme.addEventListener("click", toggleTheme);
  }

  elements.search.addEventListener("input", (event) => { state.query = event.target.value; renderPapers(); });
  elements.sort.addEventListener("change", (event) => { state.sort = event.target.value; renderPapers(); });
  document.querySelector("#clear-filters").addEventListener("click", () => {
    state.query = ""; state.tag = "全部"; elements.search.value = ""; renderTags(); renderPapers();
  });
  document.querySelector("#dialog-close").addEventListener("click", () => closePaper());
  elements.fullscreen.addEventListener("click", () => setFullscreen(!elements.dialog.classList.contains("reader-fullscreen")));
  elements.copyLink.addEventListener("click", () => copyText(location.href, "论文链接已复制"));
  elements.copyCitation.addEventListener("click", () => {
    if (state.activePaper) copyText(citationFor(state.activePaper), "引用已复制");
  });
  elements.print.addEventListener("click", printPaper);
  elements.desktopToc.addEventListener("click", scrollToSection);
  elements.mobileTocBody.addEventListener("click", scrollToSection);
  elements.dialog.addEventListener("scroll", () => {
    scheduleActiveToc();
    saveReaderScroll();
  }, { passive: true });
  elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) closePaper(); });
  elements.dialog.addEventListener("close", () => {
    clearReaderScroll();
    state.activePaper = null;
    tocSectionIds = [];
    activeTocId = "";
    if (tocScrollFrame !== null) cancelAnimationFrame(tocScrollFrame);
    tocScrollFrame = null;
    setFullscreen(false);
    syncDialogScrollLock();
    if (location.hash.startsWith("#paper=")) history.pushState({}, "", location.pathname + location.search);
  });
  elements.dialogContent.addEventListener("click", (event) => {
    const sectionLink = event.target.closest('a[href^="#section-"]');
    if (sectionLink) {
      const sectionId = sectionLink.getAttribute("href").slice(1);
      const target = elements.dialogContent.querySelector(`#${sectionId}`);
      if (target) {
        event.preventDefault();
        setActiveToc(sectionId, false);
        const toolbar = elements.dialog.querySelector(".reader-toolbar");
        const toolbarOffset = (toolbar?.getBoundingClientRect().height || 0) + 16;
        const targetTop = elements.dialog.scrollTop
          + target.getBoundingClientRect().top
          - elements.dialog.getBoundingClientRect().top
          - toolbarOffset;
        elements.dialog.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        scheduleActiveToc();
      }
      return;
    }
    const button = event.target.closest(".paper-image-button");
    if (button) openImage(button);
  });
  document.querySelector("#image-dialog-close").addEventListener("click", () => elements.imageDialog.close());
  elements.imageDialog.addEventListener("close", () => {
    elements.imageDialogImage.removeAttribute("src");
    syncDialogScrollLock();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !elements.dialog.open && document.activeElement !== elements.search) {
      event.preventDefault();
      elements.search.focus();
    }
  });
  addEventListener("popstate", openFromHash);

  initTheme(); configureNewNoteLink(); initAuthorMenu(); initStats(); renderTags(); renderPapers(); openFromHash();
})();
