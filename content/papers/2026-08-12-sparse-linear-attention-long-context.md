---
title: "从 Full Attention 到 Sparse–Linear Attention：长上下文注意力笔记"
paper_url: "https://www.haoyizhu.site/blog/sparse-linear-attention/"
authors: "Haoyi Zhu（two blogs）"
venue: "Blog + Papers"
published: "2026"
read_date: "2026-08-13"
read_at: "2026-08-13T23:06:18+08:00"
created_at: "2026-08-12T23:06:18+08:00"
updated_at: "2026-08-14T01:22:00+08:00"
status: "已精读"
tags: ["Summary", "Long Context", "Linear Attention", "Memory", "Video Generation"]
one_liner: "面对超长上下文，Sparse Attention 精确保留少数 top-K 尖峰，Linear Attention 低成本覆盖大面积长尾，各有优劣，更好的答案是让二者分工结合。另外，Kimi-k3更是给出了另一份不同的答案，KDA+MLA的结合，丢掉了RoPE使得模型架构除了效率高之外，甚至还具有zero-shot外推能力。之后，Adobe的Chimera也进一步在video generation上验证了KDA+MLA这一套框架的优势。"
paper_license: "博客未明确标注开放许可；相关论文许可见各自官方页面"
paper_license_url: ""
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/2026-08-12-sparse-linear-attention-long-context.md"
sharing: "public"
accent_headings: ["核心方法", "我的判断"]
---

## 研究问题

这篇笔记来自我读完 Haoyi Zhu 的两篇博客：

- [Sparse Linear Attention：当稀疏遇上线性注意力](https://www.haoyizhu.site/blog/sparse-linear-attention/)
- [视频 DeltaNet 的反思](https://www.haoyizhu.site/blog/video-delta-rule/)

我今天主要想表达两件事：

1. 随着 token 上下文变得非常长，Full Attention 肯定不能一直这样算下去。为了解决这个问题，目前工业界有两条主要的重要路线：**Sparse Attention 系列**与 **Linear Attention 系列**。
2. Sparse Attention 和 Linear Attention 各有明显缺点，但两边的缺点恰好互补。如何把它们组合起来，或者利用好各自的特性，可能是实现 long-context attention、同时保持效率和精度的关键。

标准 Full Attention 为

$$ {.plain}
O=\operatorname{Softmax}\!\left(\frac{QK^\top}{\sqrt d}\right)V.
$$

长度为 $L$ 时，需要处理一个 $L\times L$ 的注意力矩阵，计算复杂度约为 $O(L^2d)$。文本来到百万 token，或者视频 token 同时随帧数、分辨率和时长增长时，这个二次复杂度会很快成为训练与推理瓶颈。

正是full attention的上述问题，因此衍生出来了下面一系列方法，用来增加模型在训练和推理时候能处理的上下文长度。具体的脉络如下：

![Full Attention、Sparse Attention、Linear Attention 与混合路线总览](media/sparse-linear-attention-long-context/01-attention-landscape.png "图 1｜Full Attention 分化为 Sparse Attention 与 Linear Attention，并汇总 Sparse–Linear Hybrid、Kimi-K3 和 Chimera 三类代表案例。来源：OpenAI 内置图像生成能力按 littlewei 的笔记生成；版权：littlewei，All Rights Reserved。")

## 核心方法

### 1. 对于非常长的 token 上下文，Full Attention 肯定是不行的

本文主要讨论两类方法：Sparse Attention 和 Linear Attention。它们不是高效注意力的全部分类，但确实是当前长上下文模型中非常重要的两条工业路线。

### 1.1 Sparse Attention 系列

**原理：先低成本估算 top-K，再在 top-K 上做精确 Attention**

Sparse Attention 的核心原理是：先用便宜的成本估算哪些位置对 attention 的贡献低，把它们直接丢掉；只在估计出来贡献高的 top-$K$ 位置上计算精确 softmax attention，从而减少计算。

如果第 $t$ 个 query 经过路由后选中的位置集合为 $\mathcal S_t$，后续计算为

$$ {.plain}
o_t^{\mathrm{sparse}}
=
\sum_{s\in\mathcal S_t}
\frac{\exp(q_t^\top k_s/\sqrt d)}
{\sum_{r\in\mathcal S_t}\exp(q_t^\top k_r/\sqrt d)}v_s.
$$

整体过程可以概括为：

$$
\text{低成本估计scores}
\longrightarrow
\text{选择 top-}K
\longrightarrow
\text{只在 top-}K\text{ 内做精确 softmax attention}.
$$

代表工作主要包括：

- **[DSA](https://arxiv.org/abs/2512.02556) (token 级)：** 先用lightning indexer对每个token打分，再对每个 query选择 top-$K$ KV token;
- **[MoBA](https://arxiv.org/abs/2502.13189) (block 级)：** 先计算 query 与 block 表示的相关性，再选择 top-$k$ blocks，blocks内dense;
- **[VSA](https://arxiv.org/abs/2505.13389) (3D cube 级)：** 对视频时空 cube 做粗粒度路由，再在选中的 cubes 内精确计算.
- **区别和联系：** DSA、MoBA、VSA 的本质并没有变化：只是分别在 **token、block 和 cube** 三个粒度上做 top-K。另外需要注意不同的时间，DSA是要更晚一点，更加先进一点的范式。


**DSA：token 维度的 top-K**

DSA 先使用 head 数很少、可以运行在 FP8 上的 lightning indexer 打分：

$$ {.plain}
I_{t,s}
=
\sum_{j=1}^{H^I}
w^I_{t,j}
\operatorname{ReLU}\!\left((q^I_{t,j})^\top k_s^I\right).
$$

然后，对于每个 query $t$，只保留 indexer 分数最高的 top-$K$ 个 KV token，再在这些 token 上做精确 attention。DeepSeek-V3.2 的稀疏训练阶段取 $K=2048$。

这里需要区分两个复杂度：主 attention 只看 $K$ 个位置，复杂度可以降到约 $O(LK)$；但 indexer 仍然需要给大量 query–key 对估分，形式上仍带有二次项。它之所以便宜，是因为 indexer 的 head 更少、维度更小，并且可以使用 FP8。

**MoBA：block 维度的 top-k**

MoBA 不再逐 token 路由，而是先把上下文分成 blocks，并用 block 内 key 的均值代表整个 block：

$$ {.plain}
s_i
=
\left\langle
q,\operatorname{MeanPool}(K[\mathcal I_i])
\right\rangle.
$$

它选择相关性最高的 top-$k$ blocks，再在这些 blocks 内计算 token 级精确 attention。对于 causal LLM，当前 block 会被强制保留并施加 causal mask。

**VSA：cube 维度的 top-k**

VSA 把相同思想扩展到视频。视频 token 天然位于时间、高度和宽度三个维度，因此可以先对时空 cube 做 pooling，在 cube-to-cube 层面估算相关性，再只在选中的 cubes 内恢复 token 级精确 attention。

> [!NOTE]
> **Sparse Attention 的问题**
>
> - 可以看到，稀疏注意力的核心就是：**低成本估算 top-K，然后只在 top-K 位置算精确 softmax attention，其余位置全部丢弃。** 这样计算复杂度固然降下来了。LLM 中 top-$K$ 可以取 2048 这个量级；视频生成工作里也经常只保留约 $10\%$ 左右的精确计算，不过具体密度因模型和实验设置而异，例如 VSA 的核心设置常用 $12.5\%$。
>
> - 问题是：绝大部分位置的信息被直接丢弃，未免有些浪费，也不够精确。那些单个权重不高、但数量庞大的“长尾”位置，加起来的贡献可能并不可忽略。此外，路由器还可能漏掉真正关键的 token。


### 1.2 Linear Attention 系列

**Vanilla Linear Attention：从一阶泰勒展开理解**

Linear Attention 的目标是不显式构造 $L\times L$ attention matrix，而是提前聚合 key–value 统计量，把序列长度方向上的计算变成线性复杂度。

经典 kernel linear attention 通常从核函数分解出发：

$$ {.plain}
\exp(q^\top k)
\approx
\phi(q)^\top\phi(k),
$$

然后利用矩阵乘法的结合律改写计算。为了更直观地理解它为什么是一种有损近似，可以从 softmax 的一阶泰勒展开来看。

对于一个 query，定义缩放后的 logits：

$$ {.plain}
x_i=\frac{q^\top k_i}{\sqrt d},
\qquad
\bar x=\frac1L\sum_{i=1}^{L}x_i,
\qquad
y_i=x_i-\bar x.
$$

softmax 对整体平移不变，因此

$$ {.plain}
\operatorname{Softmax}(x)
=
\operatorname{Softmax}(y).
$$

对指数函数在 $y_i=0$ 附近进行展开：

$$ {.plain}
e^{y_i}
=
1+y_i+\frac{y_i^2}{2}+\frac{y_i^3}{6}+\cdots.
$$

因为 $\sum_i y_i=0$，只保留一阶项时，softmax 的分母约等于 $L$：

$$ {.plain}
p_i
=
\frac{e^{y_i}}{\sum_j e^{y_j}}
\approx
\frac{1+y_i}{L}
=
\frac1L
\left[
1+\frac{q^\top(k_i-\bar k)}{\sqrt d}
\right].
$$

代入 $o=\sum_i p_i v_i$：

$$ {.plain}
o
\approx
\bar v
+
\frac{1}{L\sqrt d}
\left[
\sum_i v_i(k_i-\bar k)^\top
\right]q.
$$

**核心：** 括号中的 key–value 统计量可以提前累积，不再需要为每个 query 与所有 key 显式计算 pairwise attention。若把 head dimension 视为常数，复杂度随序列长度为 $O(L)$；更严格地写，常见实现约为 $O(Ld^2)$，recurrent state 的大小约为 $O(d^2)$。

> [!NOTE]
> **需要注意的是：**
>
> 经典 Linear Attention 并不严格等同于“一阶泰勒展开”：经典方法通常从 kernel feature map 出发，而这里的泰勒展开是一种解释和构造线性近似的方式。对我这篇笔记而言，泰勒视角最重要的作用，是解释误差为什么会随 attention 分布变 sharp 而增大。

**为什么 Linear Attention 在 sharp 分布上误差大？**

如果把 softmax 继续展开到二阶，可以得到

$$ {.plain}
p_i
\approx
\frac1L
\left[
1+y_i+
\frac12\left(y_i^2-\overline{y^2}\right)
\right].
$$

所以，一阶截断丢掉的正是 $y_i=x_i-\bar x$ 的二阶及以上项，其大小由 logits 偏离均值的程度，也就是 $\overline{y^2}$ 等高阶中心矩控制。

换句话说：

- 原始 softmax attention 越平坦，所有 $y_i$ 越接近 0，一阶近似越准确；
- 原始分布越 sharp，少数大 logit 被指数函数强烈放大，一阶近似越容易严重低估尖峰；
- 当 $y_i<-1$ 时，一阶近似权重 $(1+y_i)/L$ 甚至会变成负数；
- 总误差通常会随 logits 标准差快速增长，但严格来说，误差还受偏度、峰度和 outlier 等高阶统计量影响，并不只由标准差一个数决定。

因此，Linear Attention 虽然在序列长度上非常便宜，但它本质上用固定统计量或状态替代了完整 softmax interaction，一定会损失信息。它最擅长的是大面积、相对平坦的 attention 区域，最不擅长的恰好是少数 sharp peaks。如下图所示：

![一阶线性近似在平坦与尖锐 logits 上的误差](media/sparse-linear-attention-long-context/04-logist_imgs.png "图 2｜平坦分布（std=0.5）时一阶近似贴近 softmax；尖锐分布（std=2.5）时近似会变负并错过尖峰，总误差随 logits 标准差增大。来源：Haoyi Zhu, Sparse Linear Attention（https://www.haoyizhu.site/blog/sparse-linear-attention/assets/linear_approx_toy.png）；版权：Haoyi Zhu。")

### 1.2.1 KDA 系列：Vanilla → Delta → GDN → KDA

下面统一使用 $S_t\in\mathbb R^{d_k\times d_v}$ 表示 recurrent state，并令

$$ {.plain}
o_t=S_t^\top q_t.
$$

**Vanilla Linear：只会累加**

$$ {.plain}
S_t=S_{t-1}+k_t v_t^\top.
$$

每个 token 都向状态中写入一个 rank-1 外积。旧信息会一直累积，状态本身不会主动覆盖或忘记，因此序列越长越容易出现记忆冲突。

**Delta Rule：会修改**

把 $S$ 看作一个在线学习模型，并定义当前 token 的预测误差：

$$ {.plain}
\mathcal L_t(S)
=
\frac12\left\|S^\top k_t-v_t\right\|_2^2.
$$

对 $S$ 做一步梯度下降，可以得到 Delta Rule：

$$ {.plain}
\begin{aligned}
S_t
&=S_{t-1}
-\beta_t k_t\left(k_t^\top S_{t-1}-v_t^\top\right)\\
&=\left(I-\beta_t k_tk_t^\top\right)S_{t-1}
+\beta_t k_t v_t^\top.
\end{aligned}
$$

其中第一项会沿当前 key $k_t$ 的方向擦除旧内容，第二项再写入新的 value。也就是说，Delta 不再只是累加，而是会根据当前输入修改已有记忆，从而使得记忆更准、误差更小。

**GDN：会忘 + 会修改**

[Gated DeltaNet](https://arxiv.org/abs/2412.06464) 在 Delta Rule 上增加一个标量遗忘门 $\alpha_t$：

$$ {.plain}
S_t
=
\alpha_t
\left(I-\beta_t k_tk_t^\top\right)S_{t-1}
+\beta_t k_t v_t^\top.
$$

Delta 负责定向修改，$\alpha_t$ 负责让整个旧状态快速衰减，因此 GDN 同时具备“忘”和“改”的能力。

**KDA：更细粒度地忘 + 修改**

[Kimi Delta Attention](https://arxiv.org/abs/2510.26692) 进一步把标量遗忘门换成逐通道的向量门 $\boldsymbol\alpha_t$：

$$ {.plain}
S_t
=
\left(I-\beta_t k_tk_t^\top\right)
\operatorname{Diag}(\boldsymbol\alpha_t)S_{t-1}
+\beta_t k_t v_t^\top.
$$

不同通道可以使用不同的遗忘强度，因此状态管理更加细粒度。

这条演进路线可以概括为：

> **Vanilla Linear：累加 → Delta：会修改 → GDN：会忘 + 修改 → KDA：更细粒度地忘 + 修改。**


> [!NOTE]
> **联系和缺陷：**
> 这些方法都可以视作 recurrent linear attention 或 fast-weight memory 的变体：它们通过遗忘和补偿机制，显著改善了状态更新方式。但需要注意，它们并没有恢复完整的 token-to-token softmax attention，因此在 sharp attention 和精确 retrieval 场景中仍会受固定状态容量限制。

> 更准确地说，KDA 的问题不一定等同于“同一个一阶泰勒截断误差”，因为 KDA 是学习到的 recurrent memory operator，不是简单把 softmax 逐项做泰勒展开；但两者具有相似的实际短板：都无法像 Full Attention 一样无损保存并精确寻址所有历史 token。

### 1.2.2 TTT 系列

TTT 与 KDA 系列的出发点比较接近：都把序列处理理解为对隐藏状态的在线更新。TTT 直接把隐藏状态 $W_t$ 看成一个小模型，并在测试序列上执行梯度更新：

$$ {.plain}
W_t
=
W_{t-1}
-\eta\nabla_W\ell(W_{t-1};x_t).
$$

从这个角度看，Delta Rule 本身确实可以理解成一次结构非常明确的梯度下降。TTT 则允许使用更一般的模型、损失函数和 mini-batch 更新，因此更加精细、表达能力也更强。

两者的主要差别可以这样理解：

- **KDA / Delta**：把更新规则直接写成固定矩阵递推，推理时不需要调用通用 autograd 做一次完整反向传播，容易实现成高效 fused kernel；
- **TTT**：前向过程中需要计算 inner-loop gradient，外层训练还要穿过这些更新，因此计算和系统实现更复杂；
- 原始 TTT 没有 GDN/KDA 这种显式、独立的遗忘门，但这不等于完全不会遗忘，它也可能通过梯度更新覆盖旧记忆；
- TTT 因为考虑梯度下降问题，一般使用 dual form、mini-batch 等方式降低开销，所以“每个 token 都做一次普通大模型反向传播”也不准确。

> [!NOTE]
> **基本结论是：KDA 是被高度结构化、工程效率很高的在线更新；TTT 是更一般、更精细，但通常也更贵的在线更新。**

### 2. 如何巧妙利用上述技术，实现高效的 Long-Context Attention？

Sparse Attention 和 Linear Attention 虽然各有问题，但它们带来的加速以及扩展更长上下文的优势非常明显。真正重要的问题不是要不要使用它们，而是如何利用它们的优势，同时尽可能弥补劣势。

### 2.1 成功案例 1：KiMi-K3 (LLM中)

在 Kimi-K3的模型架构中，KDA 与 Full MLA 以 **3:1** 的比例交替工作：

- KDA 负责低成本传播 global state，把长历史压缩进 recurrent state；
- MLA 负责 fine-grained retrieval，在需要时恢复 token-to-token 的精确内容寻址。

这个分工非常自然。纯 KDA 的状态大小固定，适合传播全局信息，却不擅长从百万 token 中精确找回某一个细节；Full MLA 虽然更贵，却可以补上这个 retrieval 缺口。

> [Kimi K3 官方配置](https://github.com/MoonshotAI/Kimi-K3)包含 69 个 KDA layers 和 24 个 Gated MLA layers，比例约为 $2.9:1$，可以近似理解为 3:1。严格的“3 个 KDA + 1 个 MLA”描述来自 Kimi Linear 的层间配比，K3 则是整体比例接近 3:1。

**需要强调的是：**KDA 本身已经通过 recurrent state、decay、causal recurrence 和 ShortConv 引入了顺序与局部性。Kimi Linear 进一步在 Full MLA layers 中使用 NoPE，因此不存在“RoPE 超过训练长度后，频率本身如何外推”的直接问题。

不过这里需要保留一个限定：**NoPE 消除了 RoPE 的直接外推瓶颈，但不自动保证模型可以 zero-shot 外推到任意长度，但外推能力比原有RoPE要好。** 不过状态容量、训练长度分布、扫描顺序和数值稳定性仍然会限制实际表现。

### 2.2 成功案例 2：Chimera (VDM中)

直接把视频 token 拉平后送进 KDA 也能训练，Adobe的[Chimera](https://arxiv.org/abs/2607.28611) 就是这样做的。它使用 temporal-major raster order 把视频序列化，并采用 3:1 的 KDA–MLA 混合骨干，再使用 modality-aware ShortConv 注入局部结构。

论文报告了三个很有代表性的结果：

1. dense backbone 相比匹配的 Full-Attention Wan-2.1 2B 基线达到 $1.7\times$ compute efficiency；
2. 加上完整系统中的其他设计后，总体达到 $7.3\times$，因此不能把 $7.3\times$ 全部归因于 KDA；
3. 模型只在 5 秒视频上训练，却可以 zero-shot 外推到 30 秒，最后 5 秒的 FID 只恶化 $6.5\%$。

原文中最值得保留的一句是：

> “our dense backbone achieves 1.7× the compute efficiency of a matched full-attention Wan-2.1 (2B) baseline”

这说明，把视频 token 拉平成一维序列交给 KDA，至少已经是一个有效、可扩展的工程方案。

但是第二篇博客提出了一个很重要的反思：一帧内部的 raster、snake、Hilbert 等扫描顺序是人为规定的，而逐 token 的 rank-1 state update 一般不满足交换律。因此即使输入 token 集合相同，只要帧内顺序改变，最终状态也可能不同。

所以，Chimera 证明的是“拉平以后能工作”，而不是“视频天然就应该被当成一维序列”。构造对帧内排列更稳定、同时保持时间因果性的 video-native update，仍然是一个开放问题。

### 2.3 成功案例 3：Sparse–Linear Attention

现在把 Sparse Attention 和 Linear Attention 放在一起看，会发现它们正好互补：

- Linear Attention 可以近似整个 attention，但在分布 **sharp 的地方，也就是 top-K 尖峰通常所在的地方，误差最大**；
- Sparse Attention 在 top-K 位置计算**精确 softmax attention**，但把占绝大多数的**平坦区域整个丢掉**；
- 而这些平坦、单点权重不高但数量巨大的长尾区域，恰好是低阶线性近似最擅长的地方。

一个自然的想法就是把它们结合起来：

> **在 top-K 区域做 sparse exact softmax attention，剩余位置用 Linear Attention 近似。**


**SLA：把 blocks 分成关键、边缘和可忽略三类**

[SLA](https://arxiv.org/abs/2509.24006) 先通过分块平均估计 block-level attention weight：

$$ {.plain}
P_c
=
\operatorname{Softmax}\!\left(
\frac{\operatorname{pool}(Q)\operatorname{pool}(K)^\top}{\sqrt d}
\right).
$$

在一组代表性配置中，它把 blocks 分成三类：

- top $5\%$ 的关键块：走精确的 block-sparse softmax attention；
- bottom $10\%$ 的可忽略块：直接跳过；
- 中间约 $85\%$ 的 marginal blocks：走 Linear Attention。

最后把两部分结果融合：

$$ {.plain}
O
=
O^{\mathrm{sparse}}
+
\operatorname{Proj}(O^{\mathrm{linear}}).
$$

SLA 的问题是，它实际上计算了两个不同的 attention branch，再学习一个 projection 把它们缝合起来。两个分支的归一化并不天然一致，所以通常还需要少量训练或微调。

**PISA：直接拆分同一个 softmax attention**

[PISA](https://arxiv.org/abs/2602.01077) 提出了一个更自然的改进：与其分别计算两个 attention，再学习 projection 去缝合，不如**直接把同一个 softmax attention 拆成两部分，然后对非 top-K 区域做泰勒展开来线性化。**

设 top-K 精确集合为 $\mathcal S$，其余位置为 $\mathcal U$：

$$
o
=
\frac{N_{\mathcal S}+N_{\mathcal U}}
{Z_{\mathcal S}+Z_{\mathcal U}}.
$$

$\mathcal S$ 中的分子与分母精确计算；$\mathcal U$ 中的 token 则围绕 block centroid $\bar k_j$ 做低阶展开。对于第 $j$ 个 block，由于

$$
\sum_{i\in\mathcal B_j}(k_i-\bar k_j)=0,
$$

分母的一阶项会抵消，因此可以近似为

$$
Z_{\mathcal U,j}
=
\sum_{i\in\mathcal B_j}e^{q^\top k_i}
\approx
|\mathcal B_j|e^{q^\top\bar k_j}.
$$

分子再保留 value sum 和 key–value 的一阶交叉统计量。这样做最大的区别是：**精确 top-K 和近似长尾共享同一个 softmax 分母**，所以不需要额外训练一个 projection，能够 training-free 地替换已有 attention。

**PWT：进一步补上二阶项**

[PWT](https://github.com/HaoyiZhu/Piecewise-Taylor-Attention) 沿着 PISA 的思路继续向前一步：既然一阶或零阶近似的主要误差来自二阶及以上项，那就显式补充 block 内的二阶方差信息。

PISA 对非 top-K block 的质量近似为

$$
|\mathcal B_j|e^{q^\top\bar k_j}.
$$

PWT 则进一步写成

$$
Z_{\mathcal U,j}
\approx
|\mathcal B_j|
\exp\!\left(
q^\top\bar k_j
+
\frac12q^\top C_jq
\right),
$$

其中 $C_j$ 表示 block 内 key 的协方差。高效实现会使用对角方差和 pooled query 去近似这个二次型。

二阶项可以纠正零阶近似因为指数函数凸性造成的系统性低估，但也更容易被 outlier 放大。因此当前实现还需要 gate：当二阶修正异常大时，退回 PISA 的近似，避免数值爆炸。

这三种方法可以概括为：

> **SLA：分别计算，再训练一个 projection 缝合 → PISA：在共享 softmax 中做分段近似 → PWT：进一步补上二阶项。**

需要注意，PWT 目前更接近开源实验性扩展，而不是已经经过充分大规模验证的成熟论文结论。


## 我的提问

### Q1：Linear Attention 是否就是 softmax 的一阶泰勒展开？

不完全是。经典 Linear Attention 通常来自 kernel feature map；一阶泰勒是另一种线性化方法，也是解释误差来源最直观的视角。可以说“从泰勒角度理解 Linear Attention”，但不宜说所有 Linear Attention 都严格等于同一个一阶展开。

### Q2：KDA 增加遗忘和修改以后，是否解决了 sharp attention 的问题？

没有完全解决。KDA 改善的是 recurrent state 的写入、覆盖和遗忘方式；它仍然不能像 Full Attention 那样保存每一个历史 token 并做精确内容寻址。因此 Kimi 仍然需要周期性插入 MLA layers。

### Q3：KDA 不使用 RoPE，是否意味着可以无限长度外推？

不是。它避免了 RoPE 频率本身的超长外推问题，但仍受到固定状态容量、训练分布、扫描顺序和数值稳定性影响。Zero-shot length extrapolation 是需要实验验证的能力，不是 NoPE 自动提供的保证。

### Q4：TTT 是否就是一个更慢、更精细的 KDA？

作为直觉可以这样记，但需要补充：KDA 把更新写成特定高效 recurrence，TTT 允许更一般的隐藏模型与损失。TTT 的 inner-loop gradient 通常更贵，但它也可以通过 dual form 和 mini-batch 并行优化；TTT 没有显式 KDA forget gate，也不等于完全不会遗忘。

### Q5：视频 token 直接拉平送入 KDA 是否已经足够？

Chimera 证明这个方案有效，但帧内扫描顺序仍是人为归纳偏置。不同扫描顺序对应不同的非交换 state update，因此更 video-native、帧内顺序更稳定的更新规则仍值得研究。


## 下次只看这些

1. **方法演进图：** Sparse Attention 选择并精算少数位置；Linear Attention 把全部历史压进固定状态。
2. **一条演进：** Vanilla 累加 → Delta 修改 → GDN 忘 + 修改 → KDA 更细粒度地忘 + 修改。
3. **一个结论：** Sparse 精确尖峰、Linear 近似长尾；KDA + MLA 与 SLA → PISA → PWT 都是在落实“尖峰精算，长尾近似”。

### 主要资料

- Haoyi Zhu：[Sparse Linear Attention：当稀疏遇上线性注意力](https://www.haoyizhu.site/blog/sparse-linear-attention/)
- Haoyi Zhu：[视频 DeltaNet 的反思](https://www.haoyizhu.site/blog/video-delta-rule/)
- [DeepSeek-V3.2 / DSA](https://arxiv.org/abs/2512.02556)、[MoBA](https://arxiv.org/abs/2502.13189)、[VSA](https://arxiv.org/abs/2505.13389)
- [Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention](https://arxiv.org/abs/2006.16236)
- [Gated DeltaNet](https://arxiv.org/abs/2412.06464)、[Kimi Linear / KDA](https://arxiv.org/abs/2510.26692)、[TTT](https://arxiv.org/abs/2407.04620)
- [Kimi K3 官方仓库](https://github.com/MoonshotAI/Kimi-K3)、[Chimera](https://arxiv.org/abs/2607.28611)
- [SLA](https://arxiv.org/abs/2509.24006)、[PISA](https://arxiv.org/abs/2602.01077)、[PWT](https://github.com/HaoyiZhu/Piecewise-Taylor-Attention)
