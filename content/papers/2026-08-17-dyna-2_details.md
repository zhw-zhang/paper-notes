---
title: "Dyna-2: A 1-Million-Hour Scaling Law for World-Action Models（精读详版）"
paper_url: "https://www.dyna.co/dyna-2"
authors: "Dyna Robotics"
venue: "Dyna Research"
published: "2026"
read_date: "2026-08-17"
read_at: "2026-08-17T14:57:00+08:00"
created_at: "2026-08-17T14:57:00+08:00"
updated_at: "2026-08-29T21:03:48+08:00"
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
3. **Human → robot（post-training / on-robot）：** 再给少量 robot data 后，这条趋势能迁移到真实机器人执行吗？

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
> 没办法恢复 hand action 的数据并不是“废数据”。后面的消融实验恰恰会证明：这批 video-only data 对 cross-embodiment generalization 很关键。

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

![Dyna-2 人类视频阶梯上的 scaling laws](media/dyna-2/figure2-scaling-laws.png "图 1｜Dyna-2 在 1,000 到 1,000,000 小时人类视频上阶梯训练的 scaling laws；held-out human 与 zero-shot robot data 都随预训练规模改善。来源：Dyna Robotics, Dyna-2；版权状态：未明确开放许可。")

围绕开头的问题，论文最值得记住的是三层结论：

1. **WAM 在 held-out human data 上存在 scaling law。** 从 $1\text{K}$ 到 $1\text{M}$ 小时，四个指标都单调改善，并且都能被 hours 上的 power law 很好描述。
2. **存在 human-to-robot transfer scaling law。** 没见过任何 robot pre-training data 的模型，在 held-out robot data 上也随 human pre-training scale 单调改善。
3. **human video data 和 modeling objective 都很重要。** Action only 不够；只在 action-labelled human video 上 joint training 也不够。真正让 cross-embodiment scaling 涌现的，是 future video prediction 与额外 video-only data 的 co-training。

此外还有三类补充证据：

- 同一条预训练 scaling 趋势能带进少量 robot data 的 post-training，并反映到真实机器人表现；
- production 版本展示了 robustness、precision、instruction following 和 zero-shot deployment；
- one-step video generation 把三秒、三视角 manipulation video 的 latent 生成压到约 $110\text{ ms}$。

下面仍按我原 blog 的顺序：先讲“以什么方式建模”，再回到每组实验具体看这些结论是怎么被证明的。

## 2. 以什么方式建模？

### 2.1 模型架构：MoT（mixture of transformers）

![Dyna-2 模型架构](media/dyna-2/figure3-architecture.png "图 2｜Dyna-2 的 Mixture-of-Transformers 架构。来源：Dyna Robotics, Dyna-2；版权状态：未明确开放许可。")

Dyna-2 是一个建立在 video-diffusion backbone 上的 World-Action Model：同一个 generative model 可以一起或分别 denoise future video 与 future action。

整体是一套 MoT。Video 和 action 分别 tokenized，并进入各自的 DiT / Transformer 分支；proprioception 直接 tokenized 后送入 action transformer。两条分支不是完全隔离，而是在前面的浅层通过 attention 交换信息。

三个设计点最重要：

1. **Video tokens 使用 causal mask。** 每一帧只能读取自己和更早的画面。否则训练时会提前看见后面的 future frames，表面上预测很准，实际运行时却拿不到这些“未来答案”。
2. **Action tokens 使用 bidirectional self-attention。** 同一个 action chunk 里的各个时刻可以互相参考，因为机械臂接下来的几步需要一起协调；同时它会 attend observed video context 的 tokens / features。
3. **Action transformer 更浅。** Dyna 基于“视频扩散模型的 temporal reasoning 主要发生在前层”的观察，只让 action stream 在 video backbone 的早期层 join。这样能明显降低实时推理延迟，而且作者报告 action performance 没有损失。

还有一个容易忽略的细节：**text tokens 不直接进入 action tokens**，而是由 video tokens cross-attend text。语言对 action 的影响，需要经过 video / shared representation 这条路径。

### 2.2 训练目标：口语上说 jointly predict，数学上是两个 marginal velocity fields

Dyna-2 使用 flow matching。令 $c$ 是 conditioning context（past frames、proprioception、language instruction），$z$ 是 future video latent，$a$ 是 future action chunk。真实样本沿直线路径加噪：

$$ {.boxed}
z_t = tz + (1-t)\varepsilon_z, \qquad
a_t = ta + (1-t)\varepsilon_a,
\qquad \varepsilon_z,\varepsilon_a \sim \mathcal{N}(0,I).
$$

网络学习预测把 noisy sample 拉回真实数据的 velocity。用于 scaling-law 研究的模型同时优化 video loss 与 action loss：

$$ {.boxed}
\mathcal{L}_{\mathrm{co}}(\theta)
=
\mathbb{E}\left\|u_\theta^{\mathrm{vid}}(z_t;t,c)-(z-\varepsilon_z)\right\|^2
+\lambda\,
\mathbb{E}\left\|u_\theta^{\mathrm{act}}(a_t;t,c)-(a-\varepsilon_a)\right\|^2.
$$

我原来写“jointly predict video and action”没有错，但需要把边界说清楚：两个 loss 共享 trunk / representation，**action velocity field 并不把 noisy future video latent $z_t$ 当作输入**。所以这不是“先生成未来视频，再从生成的视频里读 action”。

这也直接解释了一个推理时的特殊情况：

> [!IMPORTANT]
> Action 分支训练时只依赖 observed context 与自身 noisy action，不依赖预测中的 noisy future video。因此推理时可以不生成 future video，只预测 action；video loss 的作用是塑造 shared world representation，而不是让 policy 在线 rollout 一个视频再做决定。

### 2.3 Attention map：我真正关心的是 information path

![Dyna-2 训练与推理 attention mask](media/dyna-2/attention-map.png "图 3｜基于原文架构、按本笔记重绘的 attention 示意图：训练时 video / action noisy tokens 读取 observed context；推理时 observed context 可进入 KV cache。来源：littlewei 的笔记重绘；非论文原图。")

这个图是对比 DreamZero 的 attention map 做的简略示意，主要用于看几个变量之间的关系：令 $C_i$ 表示 clean context latent，$Z_i$ 表示 noisy future video latents，$Y_i$ 表示 noisy action latents。

训练时可以抓住两条路径：

- Video noisy tokens 读取 text、observed context frames 和自身，并对 video 时间使用 causal masking；
- Action noisy tokens 读取 observed context 的中间 features、proprioception 和 action chunk 自身，但不读取 $Z_i$。

所以真正的问题不是“推理时不生成 video 会不会断掉”，而是：**video objective 学到的 world representation，到底有多少进入了 action 所读取的 early shared features？** 论文通过后面的 objective / data ablation 给出了经验性证据，但没有把 representation 在层间的分工完全解释清楚。

## 3. 一些经验性的实验，怎样一步步回答前面的四个问题？

### 3.1 No.1：held-out human data 上存在 scaling law

实验固定模型、训练与评测配置，只改变 human pre-training data：$1\text{K}$、$10\text{K}$、$100\text{K}$、$1\text{M}$ 小时，然后在固定的 100 小时 held-out human set 上评测。

结果是四个指标都单调改善，并能被 power law 描述。原文特别指出，最严格的 Accuracy@0.1 在整个 ladder 上改善约 $51\%$，而 MSE 改善约 $12\%$。这说明变化不只发生在“动作大致方向”，精细 action prediction 也持续受益。

这条结论回答的是 **human → human**，还没有证明机器人会受益。但它先确认了两点：这类数据本身可 scale；Dyna-2 架构至少能吸收百万小时经验，而没有在 $1\text{M}$ 之前明显饱和。

### 3.2 No.2：human-to-robot 的 zero-shot offline transfer scaling law

接着，作者把同一组 checkpoints 直接放到 held-out robot dataset 上：共 39 个 tasks，来自两个不同的 stationary bi-manual YAM platforms；其中 12 个是内部 benchmark，27 个来自外部 xdof ABC。所有模型都没有在 pre-training 中见过这些 robot trajectories，也没有做 adaptation 或 fine-tuning。

结果很意外：四个指标仍然按 human data scale 单调排序。作者还观察到从 $10\text{K}$ 到 $100\text{K}$ 小时附近有明显 inflection point，暗示 cross-embodiment knowledge transfer 可能需要足够覆盖度之后才涌现。

这就是论文声称的第一次 human-to-robot transfer scaling law：

> 不是“human 上变好，所以我们猜 robot 也会变好”，而是**只增加 human pre-training data，模型在完全 held-out 的 robot data 上也可预测地变好**。

但要小心它此时仍是 offline action-prediction metric，不等于真实 robot success rate。

### 3.3 No.3：cross-embodiment scaling 能不能迁移到 on-robot performance？

![Dyna-2 cross-embodiment scaling](media/dyna-2/figure8-cross-embodiment-scaling.png "图 4｜四档 human-only pre-training checkpoint 在同一批 robot task data 上 post-train；14 个任务的 mean normalized score 随预训练规模继续上升。来源：Dyna Robotics, Dyna-2；版权状态：未明确开放许可。")

实验 setting 与我原 blog 里的概括一致：分别取 $1\text{K}$、$10\text{K}$、$100\text{K}$、$1\text{M}$ 预训练得到的权重，再在 14 个单任务上使用完全相同的 post-training recipe；每个 task 最多只有 10 小时 robot data，然后分别评测真实机器人表现。

14 个任务覆盖精细 pick-and-place、绳结和衣物等 deformable-object manipulation、插管 / 转钥匙等 precision、articulated objects、dexterous hands 与 language following；运行在 parallel-jaw 双臂、五指灵巧手和 early semi-humanoid 三种 embodiments 上。

为了把不同任务的 native metric 放到一条轴上，作者先把每个任务归一化到各自可达到上限，再对 14 个任务取平均。结果随 pre-training scale 从：

$$
20\% \rightarrow 28\% \rightarrow 45\% \rightarrow 53\%.
$$

$1\text{M}$ 模型在 14 个任务中有 9 个最好。几个特别直观的例子：

- Lockbox Key Turning 在 $100\text{K}$ 及以下都没有成功，到了 $1\text{M}$ 后成功率为 $90\%$；
- Bottle Cap Untwisting 只有约 10 分钟 robot demonstrations，仍随 pre-training scale 从小模型的 $10\%$，上升到 $40\%$、$50\%$；
- Targeted Drink Retrieval 的 language-following success 从 $58\%$ 上升到 $83\%$。

所以预训练数据的 human-action scaling law，确实可以迁移到 cross-embodiment 的真实机器人表现；而且有些任务看起来存在“预训练覆盖度不足时根本做不出来”的 threshold。

### 3.4 什么因素让 cross-embodiment scaling law 涌现？

我原来把这里的问题拆成两个因素：一个是 human video 的重要性，另一个是 prediction paradigm 的重要性。原文的 controlled comparison 更准确地说，是固定 action-labelled human data 的规模，同时改变 training objective 和 data composition。

在 $5\text{K}$、$50\text{K}$、$100\text{K}$ 三档 action-labelled data 上，对比三种 recipe：

1. **Action-only：** 只有 action loss，没有 world modeling；
2. **Joint：** 在同一批 action-labelled data 上同时预测 action chunk 和 future video；
3. **Video co-training：** 在 Joint 之外，再加入同等规模、没有 action label 的 human video，只做 video prediction。

![Dyna-2 world modeling 对 human-to-robot scaling 的作用](media/dyna-2/figure10-world-modeling-scaling.png "图 5｜Action-only、Joint、Video co-training 在三档 action data 下的 zero-shot robot 评测。来源：Dyna Robotics, Dyna-2；版权状态：未明确开放许可。")

实验结论分三层：

- Jointly predict 的范式比 action-only 好：每一个 scale 上，Joint 在 39/39 robot tasks 上都胜过 action-only；
- 但**只增加 action-labelled human video，并不足以让 robot evaluation 稳定 scaling**：action-only 严重且不可预测地 overfit，Joint 虽然少一些，但也没有随 data scale 清晰上升；
- 只有加入充足 video-only data 的 co-training recipe，才随 action-data scale 改善。小规模 $5\text{K}$ 时额外 video 不占优，但 data scale 越大，差距越明显。

所以我原来那句“human-video data 和 modeling object 都很重要”需要更精确一点：

> [!IMPORTANT]
> Future prediction 决定模型有没有 world-modeling objective；额外 video-only human data 决定这个 objective 有没有新的 scaling axis。两者一起，才是 cross-embodiment transfer scaling law 涌现的关键。

### 3.5 混合 un-actioned human video 会更好，那数据是不是越大越好？

![Dyna-2 video-only scaling axis](media/dyna-2/figure11-video-scaling-axis.png "图 6｜固定 action-labelled data，只增加 video-only human data，held-out robot generalization 单调改善。来源：Dyna Robotics, Dyna-2；版权状态：未明确开放许可。")

作者随后把 action-labelled data 固定住，只扩 video-only data：

- 固定 $50\text{K}$ 小时 action data，video-only data 从 $0$、$1\text{K}$、$10\text{K}$ 增到 $50\text{K}$；
- 再把规模放大一个数量级：固定 $250\text{K}$ 小时 action data，搭配 $0$、$250\text{K}$、$750\text{K}$ 小时 video-only data。

在两档 action-data 基座上，增加 video-only data 都让 held-out robot evaluation 单调改善。这就是原文所说的 **“Video is the new scaling axis.”**

但同一批 checkpoints 在 held-out human data 上并没有因此变好，甚至略微变差。

![Dyna-2 video 的跨 embodiment 收益](media/dyna-2/figure12-video-cross-embodiment.png "图 7｜Video-only data 的主要收益体现在 cross-embodiment generalization，而不是 held-out human action prediction。来源：Dyna Robotics, Dyna-2；版权状态：未明确开放许可。")

我的理解仍然是：human-action video 学到的 human-specific action mapping 可能比较快就够用；但到了 robot 上，除了这种 mapping，还需要更通用的 world representation。增加 un-actioned human data 去训练 VDM / future prediction，正好强化了这部分 representation。

原文也给出一个更保守的解释：video training 可能稀释 action-learning gradients，因此同 embodiment 的 human evaluation 不受益；但对于 unseen embodiment，world modeling 带来的物理世界表征反而更关键。哪一个机制占主导，论文并没有完全拆开。

### 3.6 其它特性验证：WAM vs. VLA、robustness、zero-shot、instruction following

这些结果来自 production Dyna-2，训练 recipe 与前面的 scaling-law variants 不完全一样，所以它们更适合作为“能力补充”，不能直接混成同一组 scaling 证据。

**WAM vs. VLA。** 作者把 early Dyna-2 WAM 与 Dyna-1 VLA 做 apple-to-apple comparison：相同 pre-training / post-training data、相同 hyperparameters，每种架构使用三个不同 pre-training checkpoints。这个 setting 甚至偏向 VLA，因为整套数据和超参数原来就是为 VLA 调的，而且 early Dyna-2 还没有 1M-hour pre-training。

聚合 7 个任务、21 个 task × checkpoint cells 后，WAM 的 success rate 是 VLA 的 $1.55\times$，quality grade 是 $1.12\times$；head-to-head 中 early Dyna-2 赢 $65\%$，Dyna-1 赢 $29\%$，其余 $6\%$ 打平。

这支持“WAM 有明显优势”，但我不会把它写成“这篇已经证明所有 WAM 都必然优于所有 VLA”。它证明的是在作者控制的这一组 A2A setting 里，early Dyna-2 对 Dyna-1 的下限都已经更好。

**Robustness / precision。** 在切芹菜案例中，Dyna-2 切得更薄、更均匀；改变或降低照明、遮住部分 visual input、不断把已切好的食材放回砧板，它仍能持续执行直到 goal state 达成。作者特别说明，遮挡实验应理解为 sensor-loss robustness，而不是“预测了不可见世界”。

**Zero-shot production deployment。** 两个模型在 in-house 都接近 $100\%$ pass，但到了从未见过的 customer sites，Dyna-1 只有 $46\%$，Dyna-2 达到 $87\%$。这说明 production criterion 不只是完成任务，还包括 quality、throughput、reliability。

**Instruction following。** 作者在场景基本相同、只改变语言指令的 counterfactual tasks 上评测，包括 push/pull Jenga、object kitting、piece stacking 与多种 napkin manipulation。Early Dyna-2 从 action-only 换成 video co-training，overall success 从 $35\%$ 到 $67\%$；再扩到 full Dyna-2 corpus 后达到 $96\%$。这进一步说明，video prediction 不只帮助视觉泛化，也给 language grounding 提供了学习“物体和动作在物理世界中意味着什么”的监督。

### 3.7 One-step video generation：为什么我一直觉得这里最有意思？

正常的 video diffusion teacher 需要沿一条多步、整体弯曲的 probability-flow path 去噪。硬切成 one step，相当于试图一条直线抄近道：

- Trajectory regression 容易回到 conditional mean，也就是“所有可能未来的平均”，所以画面会糊；
- Distribution matching 能保细节，但 one-step student 的落点可能跑到 teacher score 从未可靠训练过的区域；
- Video 的维度远高于 image，两个低维 manifold 在高维空间中更难重叠，梯度更容易饱和或消失，甚至 collapse 成 static clip。

Dyna 把 one-step video generation 看成一个 control problem：不是把固定 teacher 当成遥远目标，而是构造一条从“student 初始化时可达的分布”通向真实 data 的连续 target path。Target 根据 student 的 online readout 缓慢移动；student 追上当前目标，target 才继续后退，始终留在 student 能可靠追到、也能可靠估分的 trust region。

令 one-step student 为 $x=G_\theta(\varepsilon)$，target measures 为 $\{q_r\},r\in[0,1]$，其中 $q_0$ 在初始化时可达，$q_1$ 是 data。Student distribution 与 target 都先用噪声 $\mathcal{D}_\sigma$ 做 smoothing，再用两个时间尺度耦合更新：

$$
\frac{\mathrm d\theta}{\mathrm dt}
\propto
-w(\hat m)\nabla_\theta
\mathbb D\!\left(p_\theta * \mathcal D_\sigma\,\|\,q_r * \mathcal D_\sigma\right),
$$

$$
\frac{\mathrm dr}{\mathrm dt}=f(\hat m).
$$

前者是 fast student update；后者是 slow target update。$f(\hat m)$ 只有在 online readout 表明 student 已经追上当前 target 时，才推进 $r$。

结果对比如下：

| Sampler | NFE | Latency | FVD ↓ | Motion ↑ | Flicker |
| --- | ---: | ---: | ---: | ---: | ---: |
| Real recorded future | — | — | — | 100% | 2.37 |
| Teacher, default schedule | 100 | 10,203 ms | 80 | 94% | 2.69 |
| Teacher, steps cut to 1 | 2 | 210 ms | 1039 | 27% | 15.81 |
| DMD2, 2 steps | 2 | 211 ms | 115 | 79% | 2.95 |
| DMD2, 1 step | 1 | 109 ms | 599 | 56% | 5.81 |
| **Dyna, 1 step** | **1** | **110 ms** | **121** | **75%** | **1.94** |

在一张 H100 上，三秒、三视角 manipulation video 从 teacher 的 $10{,}203\text{ ms}$ 降到 $110\text{ ms}$，约 $93\times$ 加速。它的 FVD 已经接近 DMD2 2-step，flicker 甚至低于 recorded future 和 full teacher；但 motion 只有 real 的 $75\%$，仍落后于 DMD2 2-step 的 $79\%$ 和 teacher 的 $94\%$。

所以“效果很好”是成立的，但“已经等价于 full teacher”并不成立。它真正厉害的是：第一次把 instruction-conditioned manipulation video 推到 one-step 且仍有可用质量，为 planning / evaluation 提供了接近实时的 future generator。

## 我的提问

### Q1：DMD 为什么 1 step 不行，Dyna 最新的 one-step 方案到底做了什么？

Ref：[之前的 ChatGPT 对话](https://chatgpt.com/s/t_6a85aae2225c81918505649cbe8dc2f0)。

我原来的直觉是：50/100-step teacher 走的是弯路，终点落在高质量流形上；直接 one-step 相当于直线抄近道，会落到“所有未来的平均”、出流形，画面糊。Score-based DMD 更近一点，但仍可能落到 teacher score 不可靠的区域。

原文现在给出的关键补充是：Dyna 并不是简单把 student 对齐到一个固定 teacher，而是让 target measure 随 student 一起移动；student 追得上，target 才逐渐往 data distribution 退。这个“pursuit / trust-region”视角，比我原来只说“跟着 student 一起动的 measure”更完整。

仍待补充的是工程细节：$q_r$ 的具体构造、online readout $\hat m$、gain $w$、control law $f$、divergence 的实际配方，官方页面都没有完全公开。

### Q2：Dyna-2 之后，后续业界要 follow scaling 吗？

Ref：[对 Dyna-2 团队的采访](https://mp.weixin.qq.com/s/_DfEhEsOUw37AmwFB0Z4AQ)。

这篇工作的价值不是“机器人学被解决了”，而是建立了一个可重复测量的性能下限：human experience 的规模，不只改善 human prediction，也能跨本体改善 robot prediction，并在少量 robot post-training 后反映到真实执行。

所以后续业界很可能会 follow scaling，但要 follow 的不只是“继续堆带 action 的人类视频”。论文真正给出的路线是：

1. 扩大 sensorized human experience；
2. 用 world-modeling objective 吸收大量 video-only data；
3. 同时研究如何缩小 embodiment gap；
4. 补上作者没有做的 model-size / compute scaling 与外部复现。

### Q3：1M 中 un-actioned video 到底占多少比例？

这仍然没有说清楚。论文为了做 controlled ablation，使用过“额外同等规模 video-only data”的 $1{:}1$ setting，也在 $250\text{K}$ action data 上加入过 $250\text{K}$ / $750\text{K}$ video-only data；但这些实验设置不等于 production 1M corpus 的真实 mixing ratio。

我之前在另一个 blog 里看到“一半数据拥有完整标注，另一半完全没有标注”，但在当前官方 Dyna-2 页面里没有找到足够明确的对应说明，因此不把它写成事实。真实比例仍是 **待补充**。

更重要的疑问是：固定 action data 后，video-only data 在实验范围内继续增加仍有效，那收益什么时候饱和？最佳 mixing ratio 是否随 model size、action-data quality 和 downstream embodiment 改变？作者没有给出完整曲线。

### Q4：Action 不 attend noisy future video latent，一旦重要推理都发生在 video 生成侧怎么办？

现在能先回答一半：这不是训练 / 推理 mismatch。Action velocity field 从设计上就不接收 $z_t$，所以推理时只预测 action 是合法的；video loss 通过 shared trunk 和 observed context features 影响 action representation。

但我的担心没有完全消失：如果 video stream 的关键 future reasoning 发生在 action 没有 join 的更深层，那么浅层 action branch 能拿到多少 world representation？作者用“joint 优于 action-only、video co-training 带来跨本体 scaling”的结果证明这条路径**经验上有效**，却没有通过 layer-wise probing、causal intervention 或 representation analysis 说明信息究竟在哪里形成、怎样流入 action。

## 局限与疑问

- **Model size 与内部细节没有公开。** 论文固定训练配置研究 data scaling，并明确把 compute / model-size scaling 留给未来；model 参数量、各分支具体深度、初始化 backbone 也没有充分披露。之前我猜测可能沿用某类大 VDM 权重，但官方页面没有证据，不能当事实。
- **1M corpus 的 action / video-only mixing ratio 不透明。** Controlled ablation 说明了方向，却不足以恢复 production recipe。
- **Scaling law 主要来自单一团队内部系统。** 外部数据只覆盖 robot evaluation 的一部分；pre-training corpus、训练代码、模型权重和大部分完整评测协议不可得，独立复现很难。
- **Offline metric 与真实成功率不是一回事。** 论文补了 14 个 on-robot tasks，这是优点；但 task 数量、embodiment 类型、post-training recipe 与 trial 数仍有限。
- **“首次”与“通用”都需要时间检验。** 论文显示了在作者设定中的跨本体 scaling，尚不能保证任意机器人、任意任务、任意数据分布都遵循同一条 law。
- **One-step 细节仍不够。** 页面给了漂亮的 formulation 与结果，但实际 target path、divergence、稳定训练 recipe 没有完整公开。

## 我的判断

这篇论文确实从多个角度验证并展示了 robot 在 human-action / un-actioned video scaling 下的 performance 变化，有很多有趣的实验设计和实验结论。

我觉得最强的地方不是单独某个绝对分数，而是问题链相对完整：

1. 先证明 human data 内部存在 scaling；
2. 再证明它 zero-shot 跨到 robot data；
3. 再用少量 robot post-training 证明趋势能落到真实机器人；
4. 最后用 action-only / joint / video co-training 拆出 cross-embodiment scaling 的关键因素。

这使“WAM 应该做 world modeling”从一个漂亮直觉，变成了有 controlled evidence 的经验结论。

但我不会把结论简化成“Dyna-2 已经证明 WAM 永远优于 VLA”，也不会把“video 越多越好”写成没有边界的 scaling law。现在更可靠的说法是：**在 Dyna-2 的架构、数据和评测范围内，future video prediction 与 video-only data 是 cross-embodiment generalization 的主要驱动因素；这条路线值得 follow，但还需要开放复现、model scaling 和更广泛 embodiments 来确认。**

One-step 仍然是我最感兴趣的点。正常 DMD2 2-step 已经很好，但相对 one-step 仍有两倍的 inference cost；Dyna 的 $110\text{ ms}$ 结果如果能被完整复现，会同时影响 WAM 的在线 planning、rollout evaluation 和 action-video joint deployment。

## 下次只看这些

1. **四个问题的过渡：** 什么数据适合 scaling？human 上成立吗？能 zero-shot 迁移到 robot 吗？真实 on-robot 还成立吗？什么 objective / data 让它涌现？
2. **最关键的机制判断：** Action label 不是唯一的新数据轴；future prediction + video-only data 才让 cross-embodiment scaling 变得清晰。
3. **最值得继续追：** One-step distillation 如何具体实现 target path 与 control law，并在 $110\text{ ms}$ 同时支持三秒、三视角 manipulation video。

[原文：Dyna-2: A 1-Million-Hour Scaling Law for World-Action Models](https://www.dyna.co/dyna-2)
