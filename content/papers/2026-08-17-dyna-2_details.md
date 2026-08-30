---
title: "Dyna-2: A 1-Million-Hour Scaling Law for World-Action Models（精读详版）"
paper_url: "https://www.dyna.co/dyna-2"
authors: "Dyna Robotics"
venue: "Dyna Research"
published: "2026"
read_date: "2026-08-17"
read_at: "2026-08-17T14:57:00+08:00"
created_at: "2026-08-17T14:57:00+08:00"
updated_at: "2026-08-29T23:23:28+08:00"
status: "已精读"
tags: ["World Action Models", "Video Generation", "Robotics"]
one_liner: "Dyna-2 在 100 万小时以上第一人称人类视频上预训练 WAM：held-out human data 上存在 scaling law，且首次给出 human-to-robot transfer scaling law；要让这种跨本体 scaling 涌现，human video data 和 modeling objective（video co-training）缺一不可。"
paper_license: "未明确开放许可"
paper_license_url: ""
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/2026-08-17-dyna-2_details.md"
sharing: "public"
accent_headings: ["研究问题", "我的判断"]
---

## 研究问题

直觉上，本篇论文想要研究、探索 **robotic scaling law**。但是现在这个方面连最基本的问题都没有一个确定的指导：

- 如何扩展 data size，什么数据适合 scaling？
- 这种数据变多之后，能在自身任务上产生 scaling law 吗？
- 自身 scaling 的同时，能帮助 robot 能力 scaling 吗？
- 以什么方式建模 action 比较好：action only、joint video-action，还是别的方案？
- 最后才是 model size 应该怎么扩展。

这篇论文没有把所有问题都解决。它固定训练配置，把 **hours of experience** 作为主要变量，所以 model-size / compute scaling 被留给了未来。但它从前几个问题上给出了很重要的回答。

### 1. 前沿：什么数据既适合、size 又能够 scaling？

现有的数据构造方式大多是直接采集机器人数据，主要有两种：远程遥控设备和特殊的采集设备。它们都可以采集到非常高质量、带 action label 的数据；但每一小时都要被刻意生产，采集复杂、耗时，很难 scaling，场景也不可能覆盖到所有真实任务。

> **Q1：那么什么样的数据适合，同时 size 规模能够 scaling？scaling 之后又能帮助 robot 能力更好吗？**

论文从一个假设出发：**“最终一款通用的机器人，应该能够完成目前人类所执行的任何具有经济价值的工作。”**

基于这样的假设，就有一类数据非常适合：**人类执行这些任务时的传感器记录，例如 video**。这种数据已经大规模存在，而且其中正好包含 manipulation policy 需要学习的东西：场景如何变化、物体怎样响应接触、手怎样和物体交互。

这一步只是找到了可能的数据源，还不能直接得出“人类视频能让机器人变强”。中间至少要跨过三道验证：

1. **Human → human：** WAM 能力随着 human data 增加，会在 held-out human data 上产生 scaling law 吗？
2. **Human → robot（zero-shot offline）：** 只在 human data 上预训练，放到从未见过的 robot data 上，scaling law 还存在吗？
3. **Human → robot（post-training / on-robot）：** 再给少量 robot data 后，这条scaling law趋势能迁移到真实机器人执行吗？

如果这三道验证都成立，才有资格继续追问第四个问题：**究竟是 action label 在起作用，还是 world modeling / video prediction 在起作用？**

### 2. 训练数据：1M 不是简单的一堆 robot trajectories

Dyna-2 使用超过 100 万小时的人类操作视频做预训练，主要是头戴式第一视角视频，包括做饭、整理、折叠、组装等日常双手操作。数据来自外部 data partners 和 Dyna 内部采集。

官方的 [Infrastructure 文章](https://www.dyna.co/research/dyna-2-infrastructure) 给出过更具体的 corpus 量级：约 4270 万个 clips、96107 条不同 task instructions、9898 类 objects。

但是 **1M 并不等于 1M 小时完整的 human-action pairs**。数据里混合了两类内容：

- **Human-action video：** 通过手部姿态提取，得到了 pseudo-action supervision；
- **Video-only human data：** 没有达到 action annotation 的质量门槛，但仍可用于 future video prediction。

构造 action 的过程大致是：

1. 对原始视频做数据清洗、手部姿态提取、验证和过滤；
2. 对通过质量门槛的 episode 恢复 3D hand-pose tracks；
3. 用 wrist poses 表示 end-effector trajectory；
4. 用拇指和食指开合距离，构造连续 grasp signal。

这里需要注意：action 是从 human video 中抽出来的 pseudo action，并不是机器人本体的原生 control command。论文也没有通过 visual processing 或 embodiment-specific processing，主动缩小 human 与 robot 之间的视觉或运动学差距。作者就是想看：**只靠 scaling 本身，能不能跨过 embodiment gap。**

为了让每一档只改变数据量、不偷偷改变数据分布，作者构造了严格嵌套的 $1\text{K}$、$10\text{K}$、$100\text{K}$、$1\text{M}$ 小时子集：大一档只增加数据，不替换前一档的数据，并保持不同数据来源的比例一致。另外固定保留 100 小时、与训练集完全不相交的 held-out human data。

> [!NOTE]
> **Note：** 没办法恢复手部action的数据也有用，后面的消融实验恰恰会证明：这批 video-only data 对 cross-embodiment generalization 很关键。

### 3. 评测：用什么指标衡量 scaling law？

Dyna-2 根据前面的画面、proprioception 和 instruction 预测下一段 action chunk，再和 GT action 比较。

举个简单例子：只看四个已归一化控制量（对应三个方向的移动 + 夹爪开合），真实动作是 $[0.20,-0.40,0.70,0.00]$，模型给出 $[0.15,-0.20,0.62,0.60]$，四项绝对误差就是 $[0.05,0.20,0.08,0.60]$。

- **L1：** 四项绝对误差直接取平均，等于 $0.2325$，回答“模型平均偏了多远”。
- **MSE：** 误差先平方再平均，约为 $0.102$。最后一项错了 $0.60$，平方后占比很大，所以 MSE 对少数严重错误更敏感。
- **Accuracy@0.5：** 统计误差小于 $0.5$ 的比例。这个例子前三项合格、最后一项不合格，准确率为 $75\%$。
- **Accuracy@0.1：** 阈值收紧到 $0.1$，只有 $0.05$ 和 $0.08$ 两项合格，准确率为 $50\%$，更能反映动作是否足够精细。

四个指标一起报告，是为了避免 scaling claim 被某一种评分方式“造”出来：L1 和 MSE 衡量连续误差；两个 Accuracy 看落在可接受范围内的 action dimensions 比例。作者的经验是，$0.5$ 更像大致 motion intent，$0.1$ 更像精细 movement precision。

此外，每一个 data scale 都评测训练后期窗口中的 10 个 checkpoints，报告 mean 和 standard deviation，尽量避免 checkpoint 随机性影响结论。

### 4. 先把答案放在前面

![Dyna-2 人类视频阶梯上的 scaling laws](media/dyna-2/figure2-scaling-laws.png "图 1｜Dyna-2 在 1,000 到 1,000,000 小时人类视频上阶梯训练的 scaling laws；held-out human 与 zero-shot robot data 都随预训练规模改善。来源：Dyna Robotics。")

围绕开头的问题，论文最值得记住的是三层结论：

1. **WAM 在 held-out human data 上存在 scaling law。** 从 $1\text{K}$ 到 $1\text{M}$ 小时，四个指标都单调改善，并且都能被 hours 上的 power law 很好描述。
2. **存在 human-to-robot transfer scaling law。** 没见过任何 robot pre-training data 的模型，在 held-out robot data 上也随 human pre-training scale 单调改善。
3. **human video data 和 modeling objective 都很重要。** Action only 不够；只在 action-labelled human video 上 joint training 也不够。真正让 cross-embodiment scaling 涌现的，是 future video prediction 与额外 video-only data 的 co-training。

- **其它重要的发现和实验结论：**
  a) Cross-embodiment 泛化性：之前没见过 robot data 的情况下，只需要额外几 hours robot 数据，Dyna-2 模型就能够执行跨双手并联夹爪的任务，以及半人形和灵巧手平台相关的任务；仅仅 10 分钟的远程操作数据，就足以让 Dyna-2 学会使用两个五指机器人手来打开瓶盖。
  b) robustness, precision, instruction following
  c) zero-shot production-grade performance
  d) one-step video generation，Ref Q1

## 2. 以什么方式建模？

### 2.1 模型架构：MoT（mixture of transformers）

![Dyna-2 模型架构](media/dyna-2/figure3-architecture.png "图 2｜Dyna-2 的 Mixture-of-Transformers 架构。来源：Dyna Robotics。")

Dyna-2 是一个建立在 video-diffusion backbone 上的 World-Action Model：同一个 generative model 可以一起或分别 denoise future video 与 future action。

整体是一套 MoT。Video 和 action 分别 tokenized，并进入各自的 DiT / Transformer 分支；proprioception 直接 tokenized 后送入 action transformer。两条分支不是完全隔离，而是在前面的浅层通过 attention 交换信息。

三个设计点最重要：

1. **Video tokens 使用 causal mask。** 每一帧只能读取自己和更早的画面。否则训练时会提前看见后面的 future frames，表面上预测很准，实际运行时却拿不到这些“未来答案”。
2. **Action tokens 使用 bidirectional self-attention。** 同一个 action chunk 里的各个时刻可以互相参考，因为机械臂接下来的几步需要一起协调；同时它会 attend observed video context 的 tokens / features。
3. **Action transformer 更浅。** Dyna 基于“视频扩散模型的 temporal reasoning 主要发生在前层”的观察，只让 action stream 关注 video backbone 的早期层feature。这样能明显降低实时推理延迟，而且作者报告 action performance 没有损失。

还有一个容易忽略的细节：**text tokens 不直接进入 action tokens**，而是由 video tokens cross-attend text。语言对 action 的影响，需要经过 video / shared representation 这条路径。

### 2.2 训练目标：口语上说 jointly predict，数学上是两个 marginal velocity fields

Dyna-2 使用 flow matching。令 $c$ 是 conditioning context（past frames、proprioception、language instruction），$z$ 是 future video latent，$a$ 是 future action chunk。真实样本沿直线路径加噪：

$$
z_t = tz + (1-t)\varepsilon_z, \qquad
a_t = ta + (1-t)\varepsilon_a,
\qquad \varepsilon_z,\varepsilon_a \sim \mathcal{N}(0,I).
$$

网络学习预测把 noisy sample 拉回真实数据的 velocity。用于 scaling-law 研究的模型同时优化 video loss 与 action loss：

$$
\mathcal{L}_{\mathrm{co}}(\theta)
=
\mathbb{E}\left\|u_\theta^{\mathrm{vid}}(z_t;t,c)-(z-\varepsilon_z)\right\|^2
+\lambda\,
\mathbb{E}\left\|u_\theta^{\mathrm{act}}(a_t;t,c)-(a-\varepsilon_a)\right\|^2.
$$

“jointly predict video and action”，但需要把边界说清楚：两个 loss 共享representation，**但action velocity field 并不把 noisy future video latent $z_t$ 当作输入**。

这也直接解释了一个推理时的特殊情况：

> [!IMPORTANT]
> **NOTE：** Action 分支训练时只依赖 observed context 与自身 noisy action，不依赖预测中的 noisy future video。因此推理时可以不生成 future video，只预测 action；video loss 的作用是塑造 shared world representation，而不是让 policy 在线 rollout 一个视频再做决定。

### 2.3 Attention map：关心的是 information path

![Dyna-2 训练与推理 attention mask](media/dyna-2/attention-map.png "图 3｜基于原文架构、按本笔记重绘的 attention 示意图：训练时 video / action noisy tokens 读取 observed context；推理时 observed context 可进入 KV cache。来源：littlewei 的笔记重绘；非论文原图。")

这个图是对比 DreamZero 的 attention map 做的简略示意，主要用于看几个变量之间的关系：令 $C_i$ 表示 clean context latent，$Z_i$ 表示 noisy future video latents，$Y_i$ 表示 noisy action latents。

训练时可以抓住两条路径：

- Video noisy tokens 读取 text、observed context frames 和自身，并对 video 时间使用 causal masking；
- Action noisy tokens 读取 observed context 的中间 features、proprioception 和 action chunk 自身，但不读取 $Z_i$。



## 3. 一些经验性的实验，怎样一步步回答前面的四个问题？

### 3.1 Held-out human data 上存在 scaling law (No.1 Scaling laws)

> **实验setting**：实验固定模型、训练与评测配置，只改变 human pre-training data：$1\text{K}$、$10\text{K}$、$100\text{K}$、$1\text{M}$ 小时，然后在固定的 100 小时 held-out human set 上评测。


**实验结论**：**human → human**存在scaling laws，还没有证明机器人会受益。但它先确认了两点：这类数据本身可 scale；且Dyna-2 架构至少能吸收百万小时经验并且能力不断提升，而没有在 $1\text{M}$ 之前明显饱和。

![Dyna-2 人类视频上的 scaling laws](media/dyna-2/figure2-scaling-laws.png "重复图 1｜左半部分即本节的 held-out human scaling law，右半部分对应下一节的 human-to-robot transfer。来源：Dyna Robotics")

### 3.2 Human-to-robot 的 zero-shot offline transfer scaling law （No.2 Scaling laws）

> 实验settings：接着，作者把同一组 checkpoints 直接放到 held-out robot dataset 上测试：共 39 个 tasks，来自两个不同的 stationary bi-manual YAM platforms；其中 12 个是内部 benchmark，27 个来自外部 xdof ABC。所有模型都没有在 pre-training 中见过这些 robot trajectories，也没有做 adaptation 或 fine-tuning。

**实验结果**：结果很意外，在robot场景下四个指标仍然按 human data scale 单调scale。这就是论文声称的第一次 human-to-robot transfer scaling law：只增加 human pre-training data，模型在完全 held-out 的 robot data 上也可预测地变好。

![Dyna-2 的 human-to-robot transfer scaling law](media/dyna-2_details/figure7-human-to-robot-transfer.png "图 4｜论文 Figure 7：Dyna-2 首次展示了 human-to-robot transfer scaling law。在预训练中从未见过的 robot data 上评测，性能随 human data 的 scale 可预测地提升。来源：Dyna Robotics")

### 3.3 Cross-embodiment scaling 能不能迁移到 on-robot performance？ (No.3 Scaling laws Transfer)

![Dyna-2 cross-embodiment scaling](media/dyna-2/figure8-cross-embodiment-scaling.png "图 5｜四档 human-only pre-training checkpoint 在同一批 robot task data 上 post-train；14 个任务的 mean normalized score 随预训练规模继续上升。来源：Dyna Robotics。")

> **实验 setting: ** 分别取 $1\text{K}$、$10\text{K}$、$100\text{K}$、$1\text{M}$ 预训练得到的权重，再在 14 个单任务上使用完全相同的 post-training recipe；每个 task 最多只有 10 小时 robot data，然后分别评测真实机器人表现。
> 
> - 14 个任务覆盖: 精细 pick-and-place、绳结和衣物等 deformable-object manipulation、插管 / 转钥匙等 precision、articulated objects、dexterous hands 与 language following；运行在 parallel-jaw 双臂、五指灵巧手和 early semi-humanoid 三种 embodiments 上。

为了把不同任务的 native metric 放到一条轴上，作者先把每个任务归一化到各自可达到上限，再对 14 个任务取平均。结果随 pre-training scale 从：

$$
20\% \rightarrow 28\% \rightarrow 45\% \rightarrow 53\%.
$$

**实验结论：** 预训练数据的 human-action data 的 scaling laws，也可以迁移到 cross-embodiment 上

### 3.4.1 什么因素让 cross-embodiment scaling law 涌现？(World Modeling)

**前沿：** 这里的把问题拆成两个因素：一个是 human video 的重要性，另一个是 prediction paradigm 的重要性。

> **为了研究这两个问题，实验setting如下**:
> 实验setting：什么因素更重要呢？主要在想两个因素，一个是human video的重要性，另一个是预测范式的重要性。因此分了在3个不同data scale下设置了3个settings：数据尺度规模分别为5K、50K、100K的action-human video
> 
> - action only（model structure维度对比）
> - joint video（model structure维度对比）
> - joint video + video（额外加un-action label的human video训练对比）


**实验结论：**
    a) jointly predict的范式要比only action的好
    b) 只增加human-action video并不能scaling的提升模型的表现，反而一些un-actioned video更有用一些；值得关注的是甚至joint 100k都不如co-video 50k，两者数据量相等，反而un-actioned video更好。

![Dyna-2 world modeling 对 human-to-robot scaling 的作用](media/dyna-2/figure10-world-modeling-scaling.png "图 5｜论文 Figure 10：World modeling 对 human-to-robot transfer scaling law 的涌现至关重要。在每一个数据规模上，joint denoising 都一致地优于 action-only；而 video co-training 是唯一能随 action data 增长而持续变好的配方。来源：Dyna Robotics"){.scale85}


### 3.4.2 混合 un-actioned human video 会更好，那数据是不是越大越好？

> 实验settings：同一个model，joint predict，数据固定两个尺度的human-action video data，分别是50K和250K尺度，接着增加un-actioned human-video data

实验结论：
    a) 增加un-actioned human data确实会越来越好，而且和各种尺度的action-human video混合都会变得更好，注意这里说的更好是zero-shot的robot任务效果变好。
    b) 但是随着un-actioned human video的增加，held-out human上的表现并没有学好，甚至不变。
    c) 解释：模型基于human-action video学习到的更多是human-specific mapping，这可能很容易就够了，继续增加数据收益不大；然而到robot上面除了需要具体的human-specific任务之外，还需要学习更通用的world representation才可以，所以增加un-actioned human data进一步学习VDM，是对这种world representation的modeling有着很大的帮助。

![Dyna-2 video-only scaling axis](media/dyna-2/figure11-video-scaling-axis.png "图 6｜论文 Figure 11：Video 是新的 scaling 轴。在两个量级的 human action data 上，只增加 video data 就能改善模型的泛化能力。来源：Dyna Robotics"){.scale85}

![Dyna-2 video 的跨 embodiment 收益](media/dyna-2/figure12-video-cross-embodiment.png "图 7｜论文 Figure 12：Video data 在规模化之后带来的收益是 cross-embodiment generalization。来源：Dyna Robotics"){.scale85}


### 3.5 其它特性验证：WAM vs. VLA、robustness、zero-shot、instruction following

证明了这篇WAM使用jointly predict video prediction的好处和鲁棒性，主要作为鲁棒性测试。

**WAM vs. VLA。** 作者把 early Dyna-2 WAM 与 Dyna-1 VLA 做 apple-to-apple comparison：相同 pre-training / post-training data、相同 hyperparameters，每种架构使用三个不同 pre-training checkpoints。这个 setting 甚至偏向 VLA，因为整套数据和超参数原来就是为 VLA 调的，而且 early Dyna-2 还没有 1M-hour pre-training。

聚合 7 个任务、21 个 task × checkpoint cells 后，WAM 的 success rate 是 VLA 的 $1.55\times$，quality grade 是 $1.12\times$；head-to-head 中 early Dyna-2 赢 $65\%$，Dyna-1 赢 $29\%$，其余 $6\%$ 打平。

**Robustness / precision。** 在切芹菜案例中，Dyna-2 切得更薄、更均匀；改变或降低照明、遮住部分 visual input、不断把已切好的食材放回砧板，它仍能持续执行直到 goal state 达成。作者特别说明，遮挡实验应理解为 sensor-loss robustness，而不是“预测了不可见世界”。

**Zero-shot production deployment。** 两个模型在 in-house 都接近 $100\%$ pass，但到了从未见过的 customer sites，Dyna-1(VLA) 只有 $46\%$，Dyna-2 达到 $87\%$。这说明 production criterion 不只是完成任务，还包括 quality、throughput、reliability。

**Instruction following。** 作者在场景基本相同、只改变语言指令的 counterfactual tasks 上评测，包括 push/pull Jenga、object kitting、piece stacking 与多种 napkin manipulation。Early Dyna-2 从 action-only 换成 video co-training，overall success 从 $35\%$ 到 $67\%$；再扩到 full Dyna-2 corpus 后达到 $96\%$。这进一步说明，video prediction 不只帮助视觉泛化，也给 language grounding 提供了学习“物体和动作在物理世界中意味着什么”的监督。

### 3.6 One-step video generation：一直觉得这里最有意思？

详见 [Q1：DMD 为什么 1 steps 不行，这篇的 one-step 方案怎么做](#section-19) 的分析



## 我的提问

### Q1：DMD为什么1 steps不行，以及这篇论文提出最新的one-step方案是怎么做的？

ref：[ChatGPT 对话](https://chatgpt.com/s/t_6a85aae2225c81918505649cbe8dc2f0)，这里是一些具体怎么做的解析。。还是得有空猜测下作者怎么做的，感觉看着指标效果还不错。。接近 DMD-2 了（TODO）

论文 Table / Figure 15 把几种采样和蒸馏方案放在一起比：Teacher 要 50 NFE，硬切到 1-step 质量崩掉（FVD 1039、motion 27%）；标准 DMD2 的 1-step 也还很糊（FVD 599）。他们自己的 1-step 只要 1 NFE、约 110ms，相对 teacher **93×** 加速，FVD 121、motion 75%、flicker 1.94——flicker 甚至低于实拍未来（2.37）和 teacher（2.69）。

为什么 1-step 通常不行：50-step teacher 走的是弯路，终点落在高质量流形上；直接 1-step 相当于直线抄近道，会落到「所有未来的平均」、出流形，画面糊。score-based 的 DMD 更近一点，但仍略偏出可靠区域。Dyna 这套把训练目标从固定 teacher 改成**跟着 student 一起动的 measure**，让 1-step 落点进 trust region，所以能同时出锐利画面和动作。



### Q2：Dyna-2之后，后续业界要follow scaling吗？

这篇论文证明了WAM就是要优于VLA的。Dyna-2 之后，后续业界要 follow scaling 这条路吗？

ref：[对 Dyna-2 团队的采访](https://mp.weixin.qq.com/s/_DfEhEsOUw37AmwFB0Z4AQ)，有一些值得直接取证、和学习的地方。

回到开篇的问题：机器人学被解决了吗？这份工作当然没有彻底解决机器人问题，但它给行业带来新思考。它建立一个性能下限，激励更多实验室、公司投入scaling law研究。


### Q3：1M中非全是human-action video的，un-actioned video到底占多少比例？

- Data混合比例：在前面验证了action/un-actioned video混合对robot performance的影响，但是具体的比例并未透露，在验证的时候是按照1:1的。这取决于模型的具体效果，因为好像action-video data固定之后，增加un-actioned video也会不断的效果变好，但是没有尽头吗？作者没有给个具体的比例测试，带action和un-actioned human video data对结果的影响？？作者没体现。。（但是另一个blogs里面说了“一半数据拥有完整标注，另一半完全没有标注”）

### Q4: action不attend noisy latent，只attend clean context，一旦未来推理过程重要的都在这一侧token的推理咋办？

- 虽然权重学进去了一些，但是我还是会担心一点world representation到底在什么地方？如果noisy video生成的一支是负责主要推理的咋办？因为现在action部分推理时候只attn clean context的feature。


## 我的判断

这篇论文确实从各个角度去验证并且展示了robot在human-action/un-actioned video scaling情况下的performance变化，有很多有趣的实验设计和实验结论。

但是这篇有多个很关键的地方没说清楚：
- Model 参数量和模型内部具体结构：这可能影响具体指标和结论
- Data混合比例：在前面验证了action/un-actioned video混合对robot performance的影响，但是具体的比例并未透露，在验证的时候是按照1:1的。这取决于模型的具体效果，因为好像action-video data固定之后，增加un-actioned video也会不断的效果变好，但是没有尽头吗？？这应该不是scaling law的感觉，作者没体现。。（但是另一个blogs里面说了“一半数据拥有完整标注，另一半完全没有标注”）

- One-steps：这是怎么做的，这是我最感兴趣的点？效果好像很好，正常 DMD-2 steps 就行了，但是也是相比于 1-steps，有着两倍的 cost。



## 下次只看这些

1. 4个关键问题是怎么过渡的？什么数据更好？这类数据增加scaling law存在吗？scaling law能迁移到robot上吗？cross-embodiment的scaling law的涌现中，什么因素更重要？
2. One-step Distillation是怎么蒸馏的？最后达到110ms同时出video和action的，3 秒、3 视角的 manipulation video


