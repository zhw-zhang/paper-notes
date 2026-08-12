---
title: "Addressable Memory for Video World Models"
paper_url: "https://arxiv.org/abs/2608.07408"
authors: "Xindi Wu, Sven Elflein, James Lucas, Olga Russakovsky, Laura Leal-Taixé, Despoina Paschalidou, Jonathan Lorraine, Aljoša Ošep"
venue: "arXiv"
published: "2026"
read_date: "2026-08-12"
read_at: "2026-08-12T22:20:00+08:00"
status: "已整理"
tags: ["Video Generation", "World Models", "KV Cache"]
one_liner: "WorldTrace 先解决记忆能否被找到，再解决应该记住什么：把压缩后的 Key 放回训练分布内的虚拟位置，并用 Field 与 Landmark 两种写入器分别维护连续性和事件回忆。"
paper_license: "CC BY 4.0"
paper_license_url: "https://creativecommons.org/licenses/by/4.0/"
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/2026-08-12-addressable-memory-video-world-models.md"
sharing: "public"
accent_headings: ["核心方法", "我的判断"]
---

## 研究问题

自回归视频世界模型会把已经生成的帧留在 KV cache 中，作为之后生成的视觉记忆。问题是：当 rollout 超过训练时见过的上下文长度，旧内容即使仍然存着，也可能因为 temporal RoPE 的相对位置超出训练分布而无法被可靠检索。

所以长时记忆有两个不同的问题：**内容有没有保存下来**，以及**未来的 query 还能不能找到它**。这篇论文的关键判断是，必须先恢复 addressability，再讨论怎样压缩内容。

> [!IMPORTANT]
> “存着”不等于“读得到”。如果旧 Key 所在的位置已经落到模型没见过的 RoPE 区间，再聪明的摘要也可能无法进入注意力。

## 核心方法

WorldTrace 把固定长度的 attention window 分成远期摘要槽位 $\mathcal{S}$ 和近期原样窗口 $\mathcal{R}$：

$$
N_s + N_r = L_{\mathrm{attn}}
$$

对于当前 query 位置 $q$，第 $s$ 个摘要槽位不沿用内容原来的绝对时间，而是按槽位次序获得一个固定的虚拟位置：

$$ {.plain}
t_s^v = q - \left(L_{\mathrm{attn}} - 1 - s\right),
\qquad s=0,\ldots,N_s-1
$$

这样每个槽位始终落在训练时见过的相对距离内，同时又保持彼此可区分。

接着，旧 Key 先撤销原有 RoPE 旋转，在 canonical space 中压缩，再按照新的虚拟位置重新旋转。这样可以避免直接平均不同相位的 Key 所造成的抵消。

- **WorldTrace-Field**：对连续历史做 canonical Key averaging，更偏向维持长轨迹的整体连贯。
- **WorldTrace-Landmark**：在场景切换时保留不再改写的 landmark，更偏向稍后返回某一场景时的精确回忆。

> [!NOTE]
> 两个写入器共享同一套“可寻址位置”，差别主要在于摘要槽位里究竟保存连续统计，还是稀疏但原样的事件痕迹。

## 关键发现

- 在长 rollout 上，WorldTrace-Field 报告了 **15.5%** 的 temporal consistency 相对提升。
- 在 LoopBench 的场景重访任务上，WorldTrace-Landmark 报告了 **19.5%** 的 episodic recall 相对提升。
- 方法不重新训练生成模型，只改变推理时 KV cache 的保存方式和读取位置。
- LoopBench 让模型先离开场景 A，再经过其他位置后返回 A，用第一次访问产生的画面作为回忆目标。

> [!TIP]
> 读这篇论文时先区分 coherence 与 recall：Field 更像连续背景记忆，Landmark 更像在关键事件处拍下可再次取回的快照。

## 我的提问

### Q1：这只是一个 KV cache 压缩方法吗？

不完全是。压缩回答“固定预算里存什么”，虚拟位置回答“未来还能否读取”。论文最有价值的部分是把这两个失败来源拆开，并用受控实验说明位置分配本身会决定摘要是否有效。

### Q2：为什么不直接把所有旧位置截断到训练范围？

如果多个摘要槽位被截断到同一个边界位置，它们会在位置上变得不可区分。WorldTrace 改用 slot rank 分配不同的、训练分布内的位置，避免所有远期记忆挤在同一个坐标上。

### Q3：Field 和 Landmark 应该选哪个？

如果未来注意力需要从整段历史中平滑取信息，Field 更自然；如果 query 会集中寻找少数旧场景，Landmark 更合适。论文也把两者解释为两种不同的结构化稀疏注意力近似。

## 局限与疑问

- 它假设生成器使用 temporal RoPE，并且已知本地 attention window；对其他位置编码不一定直接适用。
- 固定槽位压缩必然有损。随着 rollout 变长，Field 的每个槽位要平均更多帧，细节会逐渐模糊。
- Landmark 只有在场景进入时被检测并保存，之后才可能被回忆；超过槽位容量后，较早 landmark 仍会被淘汰。
- 方法不改变基础模型的画质、运动或动作跟随能力，这些能力仍受原模型上限约束。

> [!WARNING]
> 论文证明的是在给定模型与 benchmark 上改善了长时视觉持久性，不等于已经解决开放世界里的通用长期记忆。

## 我的判断

我最喜欢的不是某个具体压缩算子，而是它把“记忆内容”和“记忆地址”拆成两个正交设计轴。这个视角也适合迁移到长上下文模型：先检查旧状态是否仍可寻址，再比较保留策略是否足够聪明。

结果数字很亮眼，但目前证据仍集中在视频 world model、特定 RoPE 条件和作者设计的重访任务上。若要把它当作通用方案，我还想看到更多 backbone、自然交互轨迹以及 landmark 误检情况下的稳定性。

## 下次只看这些

1. 长时失败首先可能是 addressability 问题，而不是摘要质量问题。
2. canonical Key 负责避免相位抵消，slot-rank virtual position 负责让摘要一直可读。
3. Field 保存连续统计，Landmark 保存可重访事件；两者服务于不同的未来注意力模式。
