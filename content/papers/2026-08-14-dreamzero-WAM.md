---
title: "World Action Models are Zero-shot Policies"
paper_url: "https://arxiv.org/abs/2602.15922"
authors: "Seonghyeon Ye et al."
venue: "arXiv"
published: "2026"
read_date: "2026-08-14"
read_at: "2026-08-14T13:45:42+08:00"
created_at: "2026-08-14T13:45:42+08:00"
updated_at: "2026-08-17T11:49:00+08:00"
status: "已精读"
tags: ["World Action Models", "Video Generation", "Robotics"]
one_liner: "DreamZero 是使用 video diffusion backbone 的 WAM。和 VLA 不同，WAM 将 VDM 中学到的 world-evolution knowledge 作为 prior，通过共同预测 future world states and actions 学习物理动态，同时学习建立 world transition 和 robot action 的对应关系，因此拥有强大的任务学习和知识 transfer 能力。"
paper_license: "CC BY 4.0"
paper_license_url: "https://creativecommons.org/licenses/by/4.0/"
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/2026-08-14-dreamzero-WAM.md"
sharing: "public"
accent_headings: ["核心方法", "关键发现"]
---

## 研究问题

近期具身智能的基础模型通常为 VLA。它们继承了 VLM 的语言先验，可以理解各种指令并进行语义层面的泛化；然而，它们在**新环境和未见过的物理动作**上的泛化能力很差。

例如，VLA 可以成功执行“把可乐罐移动到 Taylor Swift 旁边”（Brohan 等，2023），通过利用 VLM 预训练中获得的网络知识来识别目标位置，并将其与机器人数据中学到的移动技能连接起来。

然而，如果机器人训练数据中没有类似的特定技能，它们就无法完成像“解鞋带”这样的任务。虽然 VLM 的先验在语义层面上编码了应该做什么，但它们缺乏对动作如何执行的精确空间感知表示，以及缺乏几何、动态和各种合理运动控制的先验。

因此，除非明确收集大规模针对特定任务和环境的动作数据，否则 VLA 往往很难适应新环境或将其泛化到超出视频示范分布的新任务。

> [!IMPORTANT]
> VLM 先验更擅长回答“应该做什么”，却不自然具备“这个动作究竟应该如何执行”的几何、动力学与运动控制先验。

![DreamZero 模型架构](media/dreamzero-WAM/framework.png "图 1｜论文 Figure 4：DreamZero 模型架构。模型有三个输入：视觉上下文（VAE 编码）、语言指令（text encoder）和本体感受状态（state encoder）。它们经过自回归 DiT backbone，用 flow matching 联合预测未来视频帧和动作，再分别解码。训练时（左）每个 chunk 在干净 video context 条件下对带噪的 video/action latent 去噪；推理时（右）预测在真实世界异步执行，并把真实观测写回 KV cache，以避免误差累积。来源：Ye et al., World Action Models are Zero-shot Policies，https://arxiv.org/abs/2602.15922 ；许可：CC BY 4.0。")

## 核心方法

### Why robots need WAMs, compared with VLAs? 从 VLA 到 WAM

**1. Motivation：**
VLA 使用 VLM backbone，虽然有很强的 semantic generalization 能力，却在 unseen environments 和 unseen physical motions 上泛化能力很差。（因为更多image-text pair训练的）

DreamZero 是 WAM，使用 video diffusion backbone。不同于Latent world model或VLA train-from-scratch，WAM 更希望利用 VDM 从 large-scale data 里学到的physical dynamic作为prior（world evolution / world modeling）。

**2. 具体做法**
不同于早期 WAM先做 video prediction，再用 IDM 从预测视频里得到 action的方式。DreamZero 则 jointly predict video 和 action，++让模型学习建立 world transition 和 robot action 的对应关系，使得video prediction 成为 action 的隐式视觉推理器++。

**3. 好处**
这种 formulation 有两层：一是把提升 robot 能力进一步归结为提升 VDM；二是出现当前 VLA 不具备的三种特性：

- **zero-shot generalization** to novel tasks or new scenes
- **effective learning diverse skills from heterogeneous robot data, instead of repetitive demonstrate data**（对于VLA，只学习绑定两者的联系即可）
- **extremely efficient cross-embodiment transfer from videos**（两种跨具身迁移）


### 两种cross-embodiment transfer

DreamZero 有着强大的任务学习能力和知识 transfer 能力：

- **特定 task transfer：**人类或其他机器人的 video-only demonstration，只需 **10–20 min video** 就可以在 unseen task 上获得超过 **42%** 的相对提升。
- **不同 embodiment transfer：**让整个 DreamZero 适配一台没见过的新机器人，只需要新机器人 YAM 自己的 **30 min play data**，finetune后仍保留 zero-shot task generalization。


### 六个评估维度

论文从六个维度进行 benchmark：

1. **AgiBot Pretraining**：10 seen tasks + 10 unseen tasks，在 novel environments、unseen objects 上 zero-shot 评估；
2. **DROID Pretraining**：Franka，20 seen tasks + 20 unseen tasks，同样在 novel environments、unseen objects 上 zero-shot 评估；
3. **Post-Training**：AgiBot 上微调 3 个下游任务，同时保留 OOD robustness；
4. **New Embodiment Adaptation**：只用 30 min 数据（55 trajectories）post-train，DreamZero 在新 embodiment（YAM）上仍有 zero-shot generalization；
5. **Interactive Prompting**：野外zero-shot prompting，机器人出去，让人现场 prompt 新任务；
6. **Real-Time Inference**：模型和系统优化带来 38× speedup，支持 7Hz closed-loop control.


### 关键技术
**1. Jointly predict & AR attention struture**

![DreamZero 训练与推理 attention mask](media/dreamzero-WAM/attention-mask.png "图 2｜论文 Figure 14：DreamZero 的 attention strategy。(a) 训练时的 QKV self-attention mask：纵轴为 Query，横轴为 Key/Value。给定 conditioning frames（C0, C1, C2），模型预测下一帧 velocity（Z1, Z2, Z3）和 action（Y1, Y2, Y3）。(b) 推理时先计算条件帧的 KV-cache，再拼接上去预测 action 与 frames。例如 Y3 可以 attend 到 C0, C1, C2，把先前视觉观测当作历史。推理时 C0, C1, C2 会替换成 GT observations。来源：Ye et al., World Action Models are Zero-shot Policies，https://arxiv.org/abs/2602.15922 ；许可：CC BY 4.0。"){.narrow}


**2. Real-time inference**
这里面包括很多不同的技术，作者提到说predict video的tokek不是主要的inference瓶颈，最重要的在于diffusion steps和DiT model blocks number是主要的约束。

> Ref papers: One might expect that generating only actions (not video) would accelerate inference, but at 14B scale we empirically found out that the speed gain is minimal—the number of diffusion steps and the number of DiT blocks dominate latency. Moreover, because video and action are jointly trained for strong cross-modal alignment, naively reducing action denoising steps degrades quality. This motivates DREAMZERO-Flash.

具体包括四类加速：

- **Asynchronous Closed-Loop Execution**
- **System-level Optimizations：** CFG Parallelism；DiT Cache（16 steps → 4 steps）
- **Model Steps Optimizations：** DreamZero-Flash，详见 Q2
- **Infra Optimizations：** Torch Compile and CUDA Graphs；Post-Training Quantization；Kernel and Scheduler Enhancements



## 关键发现

1. DreamZero 开启了超越传统 VLA 和之前 WAM 的新泛化能力。
2. DreamZero 表明，**可以从多样化、异构的数据中有效地学习通用策略**，打破了通用机器人策略需要多次重复演示的传统观念。在这之前，虽然其他 WAM 研究表明，与 VLA 相比，从视频预测中学习到的先验可以提高动作学习的样本效率（Liao 等，2025；Pai 等，2025），但大多数工作仍然集中在重复演示上。此外，即使在任务特定的后训练之后，DreamZero 的环境泛化能力仍然保留，平均 task progress 比最先进的 VLA 高出 **10%**。
3. DreamZero 展示了**两种 cross-embodiment transfer 的形式**。首先，仅通过来自另一台机器人（YAM）或人类的视频演示，就能让目标机器人（AgiBot G1）在未见过的任务上性能提升超过 **42%**，而只需要 **10–20 分钟**的数据。第二，更令人惊讶的是，DreamZero 的跨具身的少样本快速适应能力：一个在 AgiBot G1 上预训练的模型，仅用 **30 分钟**的试玩数据就能适应一台全新的机器人（YAM），同时保留零样本泛化能力。

## 我的提问

### Q1：为什么 DreamZero 比之前的 WAM 效果都好？同样是 WAM，区别在哪？

需要澄清一下：虽然都叫 WAM，但很多时候差别很大。基本上只要利用“预测未来世界状态”来帮助 action prediction，都可以归到 WAM。

核心原因不是 DreamZero 发明了一个完全不同的 WAM，而是它把 WAM 这条路线“**scale 起来了**”。我认为主要有以下几个不同之处：
**1. 模型尺寸 scaling**

模型尺寸 scaling 很关键。DreamZero 用了真正很强的 14B video foundation model，因为“how the world should evolve”已经存在于 video prior。论文做了非常直接的 ablation：**5B → 14B**，task progress 直接从 **21% → 50%**。

**2. 数据 scaling**

更关键的其实可能是数据 scaling：不是学习很多重复的具体 task 数据，而是疯狂增加 diversity。
以前大家虽然有 WAM，但在训练时仍然受“robot imitation learning”的数据思路影响：围绕有限 task 反复采集高密度 demonstrations，即把 500h repetitive task data 记牢。

而 DreamZero 则从 scaling 的思路去思考，开始按照“foundation world model”的思路喂数据。它反过来认为，强大的 pretrained video model 已经从互联网视频中学到了大量“世界应该如何变化”的 prior；robot data 不需要重新教它所有物理过程，而更重要的是建立以下对应关系：

$$
\text{visual/world transition} \longleftrightarrow \text{robot action}
$$

因此，与其把 500h 用来重复少数任务，不如覆盖更多 object / motion / interaction / environment / trajectory，让这种 world-to-action grounding 尽可能广。


论文还做了消融：专门控制总数据量都为 500h，task progress 从 repetitive 的 **33%** 提升到 diverse 的 **50%**。这是这篇 paper 特别有价值的地方。

**3. 联合预测（可能）**

DreamZero 把“想象未来”和“执行 action”绑得更紧。早期 WAM，例如 Mimic-Video，大概是基于 video latent prediction 之后的 IDM（inverse 动力学）过程；而 DreamZero 则是联合学习和预测，能够把两者绑定得更紧，让预测和视频更加一致。

> [!NOTE]
> **Mimic-Video的两阶段方案**
>
> Video Model → 未来的 latent plan → Action IDM → motor action
>
> **DreamZero 的联合方案**
>
> noisy future video → Wan 14B DiT（video ↔ action jointly denoise）→ future video + action



### Q2：DreamZero-Flash 做了什么，怎么提速？和原始 DreamZero 有什么不同？

主要是算法层面的提升：**decoupled video and action denoising schedules**。

这出于一个观察：原始 DreamZero 对 video 和 action 使用同一个 diffusion timestep。问题在于，如果推理想从 16-step → 4-step → 1-step，那么 action 已经需要直接变得很准，但此时生成出来的 video latent 其实还可能很 noisy。于是出现：

> **clean action prediction conditioned on noisy video**

但普通训练里模型很少见过这种组合，因此会产生 train-test mismatch。

DreamZero-Flash 将两者拆开：

$$
t_{\text{video}} \neq t_{\text{action}}
$$

Action 的 timestep 仍然均匀采样，而 video 刻意更多采到高噪声状态。于是 inference 时即使 video 还没有完全去噪，action 也能快速预测准确。这样就可以：

$$
4\ \text{denoising steps} \longrightarrow 1\ \text{step}
$$

而且性能损失很小。


### Q3: 什么叫WAM？ 以及为什么叫做WAM，而不是VAM？
> Ref paper: Section 2.2

**WAMs：**只要利用了world modeling的能力(预测future video/state)for action prediction的都叫WAM；

**WAM vs VAM：** video action model使用video和action对齐只是其中形式之一，未来更有可能和触觉、力学感知、或学习到的别的latent representation对齐。


### Q4: Roles of Video Generation Model in action- prediction？
> VDM在action prediction领域的roles，以及发展流程，主要有以下三类方法：
>
> (Ref paper Section 2.2)

1. 用VDM推理时候合成action trajectory，接着提取action(IDM, flow map etc.)
2. 用VDM训练之前合成robot data for unseen behaviors in novel environments
3. 用VDM从large-scale data中学到的inherit rich visual dynamics priors，jointly预测video和action，让模型学习建立 world transition 和 robot action 的对应关系，使得video prediction 成为 action 的隐式视觉推理器。




## 局限与疑问

### 1. 速度方面还是有很大问题，难道一定要把video predict出来吗？有些变体增加速度，但是都是不掉点的吗？

- DreamZero：把 Joint-WAM scale 到 foundation policy。
- Fast-WAM：质疑 test-time future imagination 是否必要。
- Faster-WAM：发现完全砍 future 会伤 OOD，于是保留 one-pass latent future conditioning。
需要注意的是：Fast-WAM和Faster-WAM 延续了 DreamZero 这类 Joint-WAM 的思想，但作者自己重新搭了一套受控实验框架，backbone 用的是 Wan2.2-5B，因此没办法和DreamZero-14B直接比较绝对的谁好谁坏。

| 方法 | 推理时 future | 速度 | 普通 ID benchmark | OOD shift |
| --- | --- | :---: | :---: | :---: |
| **Joint-WAM / DreamZero 类** | 反复更新 future video latent，与 action 联合 denoise | 最慢 | 强 | 强 |
| **Fast-WAM** | 完全去掉 future slots，只看 current representation | 快很多 | 基本不掉 | 明显掉 |
| **Faster-WAM** | 保留 future-aware latent/context，但只算一次，不 rollout 到 RGB | 比 Joint 快很多 | 更强 | 显著恢复，甚至超过 Joint |

### 2.1 DreamZero 和 DreamZero-flash 从 16-step 到 4-step、1-step：应该有很大损失的吧？这种直接硬拉到few-steps的肯定有问题？

DreamZero 原始推理使用 Flow UniPC scheduler；为了得到平滑动作，基线需要 16 个 denoising steps。
普通 DreamZero 继续从 4-step 硬降到 1-step 时，任务进度从 83% 降至 52%，说明直接减少采样步数确实有明显损失。DreamZero-Flash 通过解耦 video 与 action 的噪声日程，让模型在训练时就学会“从仍然很吵的 future video 中预测干净 action”，最终把 1-step 恢复到 74%。

**DreamZero Few-Step / Flash 证据链**

$$
\begin{gathered}
\underbrace{t_v=t_a=t,\quad t\sim\mathcal{U}(0,1),\quad \mathcal{L}_{\mathrm{FM}}}_{\text{standard DreamZero training}}
\\
\Downarrow
\\
\underbrace{N_{\mathrm{solver}}=16,\quad N_{\mathrm{DiT\ forward}}\approx4}_{\text{DiT caching: solver steps are unchanged}}
\\
\Downarrow
\\
\underbrace{N_{\mathrm{solver}}:4\rightarrow1}_{\text{ordinary few-step inference}}
\\
\Downarrow
\\
\underbrace{83\%\rightarrow52\%}_{\text{DreamZero, Table 3}}
\\
\Downarrow
\\
\underbrace{t_v\neq t_a}_{\text{DreamZero-Flash training}}
\\
\Downarrow
\\
\boxed{\text{DreamZero-Flash 1-step}=74\%}
\end{gathered}
$$

另外，这里必须区分两种看起来都像“16 → 4”的加速：

1. **DiT Caching：16 个 solver steps 仍然存在。** 当相邻 velocity 的方向足够一致时，模型复用缓存结果，平均只执行约 4 次真正的 DiT forward。论文称其对视频与动作质量的影响很小。
2. **4-step sampling：真的只运行 4 个 denoising steps。** Table 3 中 DreamZero 4-step 的 83% 指的是这种设置，不是 DiT Cache 的“约 4 次 forward”，另外DiT cache还有点小问题，因为要计算相邻steps score的。


### 2.2 为什么不用 DMD？

DMD在image和video领域能做到50-steps蒸馏到4-steps且几乎没有太大损失，获得了很好的效果。但是在这里，本论文没有讨论 DMD，也没有提供相关对比，因此不能从现有证据得出“DMD 更好”或“DMD 不适用”的结论。

但是DreamZero-Flash 的 1-step 虽然约快 2.3 倍，但 74%的准确率算是掉的很多的了，原先强行拉到1-steps更差，这还是finetune之后的了。我估计使用DMD应该会更好，但是有个concern是joint predict尤其是token数量不公平情况下优化会有点问题，比如video-audio这种联合优化的DMD没做的太好，例如：ominiforcing这种做了简单尝试。

## 我的判断

这篇论文还是个很好的baseline，证明了WAM借助VDM prior jointly predict action的优势，不是用大量数据学习一个任务，而是借助video prior，训练VDM掌握的知识和action之间的联系，学到了这样的能力就有很强的transfer特性，大大提升了模型的泛化性。

这样的formulation方式确实很合理，而且容易scaling，随着VDM效果越来越好(model size和data的scaling)，WAM的效果也可以随之scaling。

但是后续优化可能是速度、AR推理的优化还需要提升。


## 下次只看这些

1. VLA到WAM各自有什么优劣？DreamZero是如何分析的？
2. 论文证明了哪些重要结论，DreamZero和以往WAM有什么核心不同？
3. 6个benchmark上证明的泛化能力很强，更重要的是：任务迁移能力、跨具身的迁移能力更强？
