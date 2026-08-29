---
title: "World Action Models are Zero-shot Policies（精读详版）"
paper_url: "https://arxiv.org/abs/2602.15922v1"
authors: "Seonghyeon Ye et al."
venue: "arXiv"
published: "2026"
read_date: "2026-08-14"
read_at: "2026-08-14T13:45:42+08:00"
created_at: "2026-08-14T13:45:42+08:00"
updated_at: "2026-08-29T22:40:00+08:00"
status: "已精读"
tags: ["World Action Models", "Video Generation", "Robotics"]
one_liner: "DreamZero 把预训练 video diffusion model 中的 world-evolution knowledge 当作 prior，通过端到端 jointly predict video and action，学习 world transition 与 robot action 的对应关系；video prediction 因而成为 action 的隐式视觉推理器，并带来 zero-shot generalization、异构数据学习和 cross-embodiment transfer。"
paper_license: "CC BY 4.0"
paper_license_url: "https://creativecommons.org/licenses/by/4.0/"
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/2026-08-14-dreamzero-WAM_details.md"
sharing: "public"
accent_headings: ["研究问题", "核心方法", "关键发现"]
---

## 研究问题

### 1. VLA 的 semantic generalization 很强，为什么 physical generalization 仍然很弱？

近期具身智能的 foundation model 通常是 VLA：从 pretrained VLM 出发，再加上 action prediction。它们继承了 VLM 的语言和视觉语义先验，可以理解各种指令，也能在 object / semantic level 上泛化；然而，它们在 **new environments 和 unseen physical motions** 上的泛化能力仍然很差。

论文用一个很直观的对比解释这种 gap：

- VLA 可以执行“把可乐罐移动到 Taylor Swift 旁边”。VLM pretraining 中的 web knowledge 帮它识别 Taylor Swift，robot data 又教过它 move / pick-and-place，于是模型可以把两者连接起来。
- 但如果 robot training data 中没有类似技能，它往往无法执行“解鞋带”。模型在 semantic level 上知道应该做什么，却没有从 static image-text pair 中自然学到这个动作究竟应该如何执行。

换句话说，VLM prior 更擅长回答 **what to do**，却缺少 **how to do it** 所需要的精确 spatial awareness，以及 geometry、dynamics 和各种合理 motion control 的 prior。因此，传统 VLA 若想学会新的 motion，通常还得显式收集大量 task-specific、environment-specific action data。

> [!IMPORTANT]
> 这篇论文真正追问的不是“机器人能不能听懂新指令”，而是：当训练数据里没有这套 physical motion 时，能否借助别的 foundation prior，直接把“世界应该怎样变化”转换成动作？

### 2. DreamZero 的核心研究假设

DreamZero 的答案是：与其从 VLM 继承 static semantic prior，不如从 pretrained video diffusion model（VDM）继承 spatiotemporal / physical dynamics prior。

强大的 video model 已经从 web-scale videos 中见过大量 object、motion、interaction 和 environment，学到了某种 **how the world should evolve**。Robot data 不必重新教它所有物理过程，更重要的是建立下面的对应关系：

$$ {.boxed}
\text{visual / world transition}
\longleftrightarrow
\text{robot action}
$$

因此，论文的研究问题可以拆成三层：

1. **Representation / alignment：**怎样把 future video 和 action 紧密绑定，让 video prediction 真正成为 action 的隐式视觉推理器？
2. **Learning / generalization：**有了 video prior 以后，模型能否从 diverse、heterogeneous、non-repetitive robot data 中学习，而不再依赖围绕少数 task 的重复 demonstrations？这能否进一步带来 unseen task、unseen environment 和 cross-embodiment 的泛化？
3. **System / deployment：**14B video diffusion backbone 需要反复 denoise，原始推理慢到无法闭环。怎样把它变成 real-time reactive policy？

DreamZero 因此不只是“给 VDM 加一个 action head”。论文想证明的是：WAM 这条路线可以被 scale 成 foundation policy，而且 policy 的能力可以跟着 video generation quality、model size 和 data diversity 一起提升。

## 相关工作：从 VLA、Video Model 到 WAM

### 1. Video generation model 在 action prediction 中的三类角色

按照论文 Section 2.2，VDM 在机器人 action prediction 中的发展大致有三条路线：

1. **Inference-time trajectory synthesis：**推理时先用 VDM 生成 future robot trajectory，再通过 IDM、optical flow 或 high-level trajectory planner 抽取可执行 action。
2. **Pre-training data generation：**先用 T2V / V2V 生成 novel environments、unseen behaviors 的 synthetic robot data，再用这些数据训练 policy。
3. **Joint video-action prediction：**直接继承 VDM 从 large-scale data 中学到的 rich visual dynamics prior，jointly predict video and action，让模型学习 world transition 和 robot action 的对应关系，使得 video prediction 成为 action 的隐式视觉推理器。

DreamZero 属于第三类。它和早期“先 video prediction、再用另一个 IDM 得到 action”的两阶段 WAM 不同：它用一个 end-to-end model 对 video/action 共同 denoise，希望通过 deep integration 获得更紧的 video-action alignment。

### 2. 什么叫 WAM？为什么不是 VAM？

论文给出的定义很宽：只要利用了 world modeling 的能力——即预测 future video / state——来帮助 action prediction，都可以归为 World Action Model（WAM）。

之所以不叫 Video Action Model（VAM），是因为 video 只是目前采用的一种 world-modeling objective。未来 action 也可能与 tactile sensing、force feedback 或 learned latent representation 对齐；“World”比“Video”更能覆盖这个 formulation。

### 3. WAM 与其他 world model 的关键区别

Latent-space world model、Dreamer 或 3D point-cloud world model 多数学习 forward dynamics，例如：

$$
p(s_{t+1}\mid s_t,a_t)
$$

它们在 deployment 时还需要单独的 IDM，或者 planning / search / MPC 才能产生 action trajectory。DreamZero 则直接建模：

$$
p(\mathbf{o}_{t:t+H},\mathbf{a}_{t:t+H}
\mid \mathbf{o}_{0:t},\mathbf{c},\mathbf{q}_t)
$$

也就是直接输出与 visual future 对齐的 action trajectory，jointly predict至关重要。

> [!NOTE]
> **DreamZero这种形式WAM 的优势是关键两点**：利用了pretrained video representation 中的 world dynamics prior，以及 jointly predict学到的video- action对齐。代价则是高维 video latent 和 iterative denoising 带来的巨大计算量。

## 核心方法

论文 Section 3 先明确了把 VDM 变成 WAM 的三个技术难点：

1. **Video-action alignment：**简单拼接两个独立 head，future video 与 action policy 不一定真的能对齐
2. **Architectural design：**bidirectional 还是 autoregressive 更适合 long-horizon world-action modeling？这会影响三模态对齐、误差累积和 inference efficiency。
3. **Real-time inference：**14B DiT 在高维 latent 上做多步 diffusion，naive implementation 无法用于 closed-loop control。

DreamZero 分别用 joint flow matching、chunk-wise autoregressive architecture，以及多层 inference optimization 来解决。

### 3.1 Joint video-action formulation

**1. 问题定义：把 video prediction 与 implicit IDM 合进同一个分布**

在轨迹的随机位置 $l$，模型看到：

- 当前与历史视觉观测 $\mathbf{o}_{0:l}$；
- language instruction $\mathbf{c}$；
- 当前 proprioceptive state $\mathbf{q}_l$。

模型要联合预测固定 horizon $H$ 内的 future video $\mathbf{o}_{l:l+H}$ 和 action $\mathbf{a}_{l:l+H}$：

$$ {.boxed}
\underbrace{
\pi_0(\mathbf{o}_{l:l+H},\mathbf{a}_{l:l+H}
\mid \mathbf{o}_{0:l},\mathbf{c},\mathbf{q}_l)
}_{\text{DreamZero}}
=
\underbrace{
\pi_0(\mathbf{o}_{l:l+H}
\mid \mathbf{o}_{0:l},\mathbf{c},\mathbf{q}_l)
}_{\text{video prediction}}
\underbrace{
\pi_0(\mathbf{a}_{l:l+H}
\mid \mathbf{o}_{0:l+H},\mathbf{q}_l)
}_{\text{implicit IDM}}
$$

这条分解很重要：前半部分先表示“在这个 instruction 下，世界接下来应该怎样变化”；后半部分表示“要得到这样的 visual future，这个 embodiment 应该执行什么 motor action”。

早期方法可以用两个模型分别学习这两项：

> Video Model → future latent plan → Action IDM → motor action

DreamZero 则把它改成：

> noisy future video + noisy action → shared Wan 14B DiT jointly denoise → aligned future video + action

核心不是发明了完全不同的 WAM，而是把 video prediction 与 IDM 放进同一个 end-to-end denoising process。这样 video 和 action 不只在最后一层相遇，而是在 shared DiT blocks 内持续交换信息，学习 joint distribution。

由于 pretrained VDM 已经会做广泛的 video prediction，DreamZero 需要补学的主要是两件事：
- 适配 robot embodiment 的视觉分布
- 从生成的 visual transition 中抽取对应 action（action预测和video预测的对齐）。

![DreamZero 模型架构](media/dreamzero-WAM/framework.png "图 1｜论文 Figure 4：DreamZero 模型架构。模型输入视觉上下文（VAE 编码）、语言指令（text encoder）和本体感受状态（state encoder），通过自回归 DiT backbone 与 flow matching 联合预测 future video 和 action。训练时当前 noisy chunk 以干净历史为条件；推理时异步执行 action，并把真实观测写回 KV cache。来源：DreamZero。")

**2 Architecture：尽量少改 video backbone**

DreamZero 从 Wan2.1-I2V-14B-480P 初始化。为了尽量保留 video foundation model 的 generalization capability，只加入少量 robot-specific modules：

- visual observation 经 pretrained VAE 变成 video latent；
- language instruction 经 text encoder 编码；
- proprioceptive state 经新增 state encoder 编码；
- normalized action 经新增 action encoder 进入 shared DiT；
- video 与 action 最后通过各自 decoder 输出。

如果 robot data 有 multiple views，作者直接把多个视角拼成一张 frame，而不是为 multi-view 改 backbone。

- 训练时更新所有 DiT blocks，以及 state/action encoder 和 action decoder，但是text encoder、image encoder 与 VAE 冻结。
- 作者也试过 LoRA，但效果不理想，所以主模型采用 full DiT update。AgiBot 与 DROID 都训练 100K steps、global batch size 128；默认 action representation 是过滤 idle action 后的 relative joint positions。

**3. 为什么使用 chunk-wise autoregressive，而不是 bidirectional？**

DreamZero 对 video modality 做 autoregressive modeling，并按 chunk 生成。作者给出三个理由：

1. **KV cache 带来更快 inference。**已经看过的视觉 history 不需要在每个 diffusion step 重算。
2. **模型可以保留 observation history。**下一段 action/video prediction 能以之前真实看到的画面为条件,替换生成的history可以避免误差累积的问题。
3. **更容易保持 language-video-action alignment。**Bidirectional diffusion 通常处理 fixed-length sequence；为了让一段长 task caption 对齐有限 video window，往往要 subsample video。但subsampling 会扭曲 native FPS，进一步破坏 frame 与 action 的精确对应。

- 这里要注意：论文说 autoregressive modeling 主要施加在 **video modality**。Action 是按当前 chunk 联合预测的，避免把先前预测 action 继续引入入 future，造成 action的误差累积问题。

具体配置是：

- 每个 chunk 有 $K=2$ 个 video latent frames；
- 默认最多 $M=4$ 个 chunks；
- AgiBot video 为 5 FPS，action 为 30 Hz，action horizon $H=48$；
- DROID video 同样为 5 FPS，action 为 15 Hz，action horizon $H=24$；
- 两种 robot 的每个 chunk 都覆盖 1.6 秒；
- 最大 visual context 为 8 个 latent frames，对应 33 个 raw frames、约 6.6 秒。

**4 Attention mask：当前 noisy chunk 只能看干净历史**

![DreamZero 训练与推理 attention mask](media/dreamzero-WAM/attention-mask.png "图 2｜论文 Figure 14：DreamZero 的 attention strategy。训练时，给定 conditioning frames（C0、C1、C2），模型预测下一段 video velocity（Z1、Z2、Z3）和 action（Y1、Y2、Y3）；例如 Y3 可 attend C0、C1、C2。推理时先计算真实条件帧的 KV cache，再与当前 noisy video/action tokens 拼接；执行后以新的真实观测替换预测 video context。来源：DreamZero。"){.narrow}

训练采用 teacher forcing：第 $k$ 个 noisy chunk 的 condition 是此前 chunks 的 clean context，而不是模型自己生成的 history。记 clean video/action 为 $\mathbf{z}_1^k,\mathbf{a}_1^k$，Gaussian noise 为：

$$
\mathbf{z}_0^k\sim\mathcal{N}(\mathbf{0},\mathbf{I}),
\qquad
\mathbf{a}_0^k\sim\mathcal{N}(\mathbf{0},\mathbf{I})
$$

那么第 $k$ 个 chunk 的干净历史为：

$$
\mathcal{C}_k=
\{(\mathbf{z}_1^j,\mathbf{a}_1^j)\}_{j=1}^{k-1}
$$

attention mask 保证 current noisy chunk 能 attend 到 clean previous chunks，但不能偷看 future chunk。这样可以一次做 trajectory-level update，同时保留 AR 的因果结构。

**5. Flow matching：共同预测 video/action velocity**

Standard DreamZero 为同一 chunk 的 video 与 action 共享一个 timestep：

$$
t_k^{\text{video}}=t_k^{\text{action}}=t_k,
\qquad t_k\sim\mathcal{U}(0,1)
$$

论文采用的 convention 是 $t=0$ 为 pure noise、$t=1$ 为 clean data。Noisy video/action 由线性插值得到：

$$
\mathbf{z}_{t_k}^k
=t_k\mathbf{z}_1^k+(1-t_k)\mathbf{z}_0^k,
\qquad
\mathbf{a}_{t_k}^k
=t_k\mathbf{a}_1^k+(1-t_k)\mathbf{a}_0^k
$$

joint target velocity 是从 noise 指向 clean sample：

$$
\mathbf{v}^k
=
[\mathbf{z}_1^k,\mathbf{a}_1^k]
-
[\mathbf{z}_0^k,\mathbf{a}_0^k]
$$

模型 $\mathbf{u}_\theta$ 同时预测 video velocity 与 action velocity，可把每个 chunk 的 loss 简写为：

$$ {.boxed}
\mathcal{L}(\theta)
=
\mathbb{E}\left[
w(t_k)
\left\|
\mathbf{u}_{\theta}
(
[\mathbf{z}_{t_k}^k,\mathbf{a}_{t_k}^k];
\mathcal{C}_k,\mathbf{c},\mathbf{q}_k,t_k
)
-\mathbf{v}^k
\right\|^2
\right]
$$

shared timestep 能让两种 modality 在训练早期更快收敛；shared objective 则迫使模型在同一 denoising trajectory 中建立 video ↔ action alignment。

**6. Closed-loop inference：预测 video 用来推理，真实 video 用来续写**

推理过程可以理解为四步循环：

1. 用当前真实 observation 做 VAE encoding，并 prefill visual KV cache。
2. 对 future video latent 与 action 都从 Gaussian noise 开始，经过 $N$ 个 solver steps jointly denoise。
3. 输出、平滑并异步执行 action chunk。
4. 取得执行后的最新真实 observation，把它写入 KV cache；当前预测的 future video latent 随即丢弃，不作为下一轮事实继续 rollout。

这一点解决了 AR video generation 最常见的误差累积问题。

### 3.2 Real-time execution

这里面包括很多不同的技术，作者提到说 predict video 的 token 不是主要的 inference 瓶颈，**最重要的在于 diffusion steps 和 DiT model blocks number 是主要的约束。**

> Ref papers: One might expect that generating only actions (not video) would accelerate inference, but at 14B scale we empirically found out that the speed gain is minimal—the number of diffusion steps and the number of DiT blocks dominate latency. Moreover, because video and action are jointly trained for strong cross-modal alignment, naively reducing action denoising steps degrades quality. This motivates DREAMZERO-Flash.

具体包括四类加速：

- **Asynchronous Closed-Loop Execution：** 工程前后运行顺序层面，异步运行
- **System-level Optimizations：** CFG Parallelism；DiT Cache（16 steps → 4 steps）
- **Model Steps Optimizations：** DreamZero-Flash，详见 [Q2：DreamZero-Flash 做了什么？](#section-19)
- **Infra Optimizations：** Torch Compile and CUDA Graphs；Post-Training Quantization；Kernel and Scheduler Enhancements


## 实验设置

### 4.1 Pretraining data：从 repetitive demonstrations 转向 diversity

**1. 作者的假设**
- VLA 只预测 action，要从 noisy heterogeneous state-action pairs 中隐式重建 dynamics，因此更依赖 task-focused repetition；
- WAM 的 world-modeling objective 已经提供 future-state supervision，robot data 更重要的任务是建立广泛的 state/world-transition ↔ action correspondence。

**2. 训练数据**
DreamZero 的 data philosophy 不是“把少数 task 重复得更密”，而是增加 object / motion / interaction / environment / trajectory 的 diversity。

AgiBot G1 数据约 **500 小时、7.2K episodes、22 个真实环境**，包括 home、restaurant、supermarket、coffee shop、office 等。每个 episode 平均约 **4.4 分钟、42 个 subtasks**，更像一段真实工作流，而不是单一 task 的反复演示。论文还在 Franka 上使用 heterogeneous public dataset DROID 做复现性验证。

**3. 模型比较**
训练时，DreamZero、GR00T N1.6 与 $\pi_{0.5}$ 使用相同 robot data、相近 total batch size 与 gradient steps。VLA baseline 又分两种初始化：

- **from-scratch：**只使用 pretrained VLM weights，没有额外 robot pretraining，与 DreamZero 的初始化方式做相对公平比较；
- **from-pretrained：**使用官方在数千小时 cross-embodiment robot data 上预训练的 checkpoint，再在相同数据上继续训练。

### 4.2 Evaluation protocol：默认就是 OOD

论文强调自己是 **generalization eval first**。训练数据与 evaluation site 位于不同 domain，因此默认评估就是 unseen environments + unseen objects，而不是训练分布内插值。

Task 的定义同时考虑 motion 和 object type。例如红色 shirt 换成黑色 shirt，仍算 seen task；但从 fold shirt 变成 fold socks，因为 motion 本身不同，就算 unseen task。

**六个评估维度为：**

1. **AgiBot Pretraining：**10 seen + 10 unseen tasks，在 novel environments、unseen objects 上 zero-shot eval；
2. **DROID Pretraining：**Franka 上 20 seen + 20 unseen tasks，同样测试 novel environments 与 unseen objects；
3. **Post-Training：**AgiBot 上 finetune 3 个 downstream tasks，同时检查 OOD robustness 是否保留；
4. **New Embodiment Adaptation：**用 YAM 的 30 min play data（55 trajectories、11 tasks）适配全新 embodiment，并检查 zero-shot object generalization；
5. **Interactive / Free-form Prompting：**让机器人在真实环境接受现场 verbal prompt，额外测试 100+ tasks；
6. **Real-Time Inference：**验证 38× speedup、7 Hz closed-loop control 与 Flash 的 speed–accuracy trade-off。

## 关键发现

### 5.1 Main results

**结论1. Diverse、non-repetitive data 也能学出 generalist policy**

DreamZero 证明：可以从 diverse、heterogeneous robot data 中有效学习通用策略，而不必假设每个 task 都需要多次重复演示。在 unseen environment / object 的 seen-task benchmark 上，DreamZero 相比 state-of-the-art VLA 的平均 task progress 提升超过 2×；很多 VLA failure 表现为只会靠近物体，却无法完成准确 contact 和 motion。

更关键的是，DreamZero 的失败多数来自 **video generation error**，而不是 action extraction error：policy 会忠实执行 video 所预测的 trajectory，即使这个 trajectory 本身是错的。这同时支持了方法的 alignment，也暴露了它的 failure propagation path。

![DreamZero 在 seen task 上的评测结果](media/dreamzero-WAM/figure8-seen-task-eval.png "图 3｜论文 Figure 8：Seen Task Evaluation（seen task 评测）。DreamZero 能有效地从多样化数据中学习并泛化到新环境，在所有任务类别上都优于 VLA。从头训练的 VLA 成功率接近于零，而预训练过的 VLA 表现一般——这可能得益于预训练期间通过重复演示获得的 embodiment-specific knowledge。来源：DreamZero。")

**结论2. Zero-shot generalization 到真正 unseen motions**

在 AgiBot 的 10 个 unseen tasks 上，包括 untie shoelaces、ironing、painting、shake hands 等：

- from-scratch VLA 平均 task progress 低于 1%；
- pretrained VLA 为 16.3%；
- DreamZero 达到 **39.5%**。

在 DROID–Franka 上，DreamZero 也达到 **49% task progress / 22.5% success rate**，超过 pretrained GR00T N1.6 的 31% / 12.5% 和 $\pi_{0.5}$ 的 33% / 7.5%。

![DreamZero 在 unseen task 上的 zero-shot 表现](media/dreamzero-WAM/figure9-unseen-task-zeroshot.png "图 4｜论文 Figure 9：Zero-shot Generalization to Unseen Tasks（对 unseen task 的零样本泛化）。DreamZero 在 10 个训练中未出现过的任务上取得了非平凡的 task progress，而 VLA 在两种 embodiment 上都很吃力。来源：DreamZero。")

**结论3. Task-specific post-training 后，environment generalization 仍然保留**

DreamZero 在 shirt folding、table bussing、fruit packing 三个 post-training tasks 上匹配或超过 VLA；即使做了 task-specific finetuning，面对不同 table height、distance、objects 和 placement 时仍保持 OOD robustness，平均 task progress 比 state-of-the-art VLA 高约 **10%**。

![DreamZero 的 post-training 结果](media/dreamzero-WAM/figure10-posttraining-results.png "图 5｜论文 Figure 10：Posttraining Results（后训练结果）。WAM 在三个任务上都能带来更强的后训练结果，说明 DreamZero 的环境泛化能力在 post-training 之后依然保留。来源：DreamZero。")

**结论4. 两种 cross-embodiment transfer**

DreamZero 展示了两种不同含义的跨具身迁移：

**A. 把别的 embodiment 的 video-only demonstration 迁移给目标机器人**

对 9 个 AgiBot unseen tasks，作者分别收集：

- YAM robot：72 条 multi-view trajectories，20 分钟；
- Human egocentric：72 条 trajectories，12 分钟。

这些 cross-embodiment data **只使用 video prediction objective，没有 action label**；同时与 AgiBot joint video-action pretraining data 按 1:1 混合，再训练 10K steps。结果是：

| 方法 | Unseen-task progress |
| --- | ---: |
| DreamZero | 38.3% |
| + Human2Robot video transfer | 54.3% |
| + Robot2Robot video transfer | 55.4% |

也就是只用 10–20 分钟 video，unseen-task performance 就获得超过 **42% relative improvement**。Robot-to-robot 更高，可能因为 YAM 与 AgiBot 都是 bimanual parallel gripper，embodiment gap 更小。

**B. 让整套 policy 适配全新的 embodiment**

从 AgiBot checkpoint 出发，只用 YAM 自己的 **30 分钟 play data（55 trajectories、11 tasks）** post-train，模型就能控制新 robot，并对 pumpkin、teddy bear、pen、cup noodle、paper bag 等没见过的新物体保持 language following 与 zero-shot generalization。

我认为这里最关键的解释是：模型不必用 30 分钟重新学习所有 world dynamics，只需学习新 embodiment 的 implicit IDM——即 predicted visual future 到 YAM motor command 的 mapping。这个 mapping 仍不简单，但可能比从 observation 直接学整套 policy 更 sample-efficient。

**结论5. DreamZero-Flash 的 speed–accuracy trade-off**

在 table bussing task 上：

| 方法 | Denoising steps | Task progress | Inference |
| --- | ---: | ---: | ---: |
| DreamZero | 4 | 83% | 350 ms |
| DreamZero | 1 | 52% | 150 ms |
| DreamZero-Flash | 1 | 74% | 150 ms |

直接硬拉到 one-step 肯定有问题：standard DreamZero 从 4-step 降到 1-step，task progress 从 83% 掉到 52%。Flash 通过 decoupled schedule 恢复到 74%，但仍比 4-step baseline 低 9 个百分点；它不是完全不掉点，而是获得更合理的 speed–accuracy trade-off。

### 5.2 Ablations：为什么 DreamZero 比此前 WAM 更强？

![DreamZero 的 model 与 data 消融](media/dreamzero-WAM/table4-model-data-ablations.png "图 6｜论文 Table 4：Model and Data Ablations（模型与数据消融）。PnP Easy 任务上的 task progress（± 标准误）。AR 表示 autoregressive，BD 表示 bidirectional。所有模型均以 50K steps、batch size 32 训练。来源：DreamZero。")

核心原因不是 DreamZero 发明了完全不同的 WAM，而是它把 WAM 这条路线 **scale 起来了**。

**1. Data diversity scaling**

控制总数据量都为 500 h：

$$
\text{repetitive data: }33\%
\quad\longrightarrow\quad
\text{diverse data: }50\%
$$

以前不少 WAM 仍受 robot imitation learning 的数据思路影响：围绕有限 task 反复采集高密度 demonstrations，相当于把 500 h repetitive task data 记牢。

DreamZero 则按 foundation world model 的思路喂数据。因为 video prediction 很大部分已从 pretraining 继承，robot learning 的关键变成建立 robust implicit IDM；而 IDM 需要的是不同 context 下广泛的 state/action correspondence，repetitive data 恰好缺少这一点。

**核心结论：** 与其把 500 h 用来重复少数任务，不如疯狂增加 diversity，让 world-to-action grounding 尽可能广。这是这篇 paper 特别有价值的地方。

**2. Model size scaling**

在同样 diverse data 下：

$$
\text{Wan 5B: }21\%
\quad\longrightarrow\quad
\text{Wan 14B: }50\%
$$

5B model 更容易产生 visual hallucination，并进一步传播成错误 action。相反，把 VLA 从 5B 扩到 14B 并没有解决 heterogeneous data learning，ablation 中仍是 0% task progress。

这说明 WAM 的 scaling 不是“参数越多自然越强”，而是更强的 pretrained video backbone 带来更好的 world prediction，再直接转化为更好的 action execution。**How the world should evolve 已经存在于 video prior**，model size scaling 提升的是这份 prior 的质量。

**3. Joint prediction 与 AR architecture**

Joint prediction 把“想象 future”和“执行 action”放在同一个 denoising objective 里，相比 video model → separate IDM 的 two-stage pipeline，能够把两者绑定得更紧。

AR 与 bidirectional 的 task progress 在 ablation 中同为 50%，所以不能说 AR 单凭 task score 就压倒性更强；它的主要收益是：

- motion 更 smooth，temporal consistency 更好；
- language-video-action alignment 更自然；
- KV caching 让 inference 快 3–4×。



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

**3. 联合预测（可能--dyna-2 已验证很重要）**

DreamZero 把“想象未来”和“执行 action”联合一起预测。早期 WAM，例如 Mimic-Video，大概是基于 video latent prediction 之后的 IDM（inverse 动力学）过程；而 DreamZero 则是联合学习和预测，能够把两者绑定得更紧，让预测和视频更加一致。

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
2. 用VDM训练之前合成robot data for unseen behaviors in novel environments（T2V or V2V）
3. 用VDM从large-scale data中学到的inherit rich visual dynamics priors，jointly预测video和action，让模型学习建立 world transition 和 robot action 的对应关系，使得video prediction 成为 action 的隐式视觉推理器。




## 局限与疑问

### 1. 速度方面还是有很大问题，难道一定要把video predict出来吗？有些变体增加速度，但是都是不掉点的吗？

- DreamZero：把 Joint-WAM scale 到 foundation policy。
- Fast-WAM：质疑 test-time future imagination 是否必要。
- Faster-WAM：发现完全砍 future 会伤 OOD，于是保留 one-pass latent future conditioning。
需要注意的是：Fast-WAM和Faster-WAM 延续了 DreamZero 这类 Joint-WAM 的思想，但这两篇作者自己重新搭了一套受控实验框架，backbone 用的是 Wan2.2-5B，因此没办法和DreamZero-14B直接比较绝对的谁好谁坏。

| 方法 | 推理时 future | 速度 | 普通 ID benchmark | OOD shift |
| --- | --- | :---: | :---: | :---: |
| **Joint-WAM / DreamZero 类** | 反复更新 future video latent，与 action 联合 denoise | 最慢 | 强 | 强 |
| **Fast-WAM** | 完全去掉 future slots，只看 current representation | 快很多 | 基本不掉 | 明显掉 |
| **Faster-WAM** | 保留 future-aware latent/context，但只算一次，不 rollout 到 RGB | 比 Joint 快很多 | 更强 | 显著恢复，甚至超过 Joint |

### 2.1 DreamZero 和 DreamZero-Flash 从 16-step 到 4-step、1-step：应该有很大损失的吧？这种直接硬拉到few-steps的肯定有问题？

DreamZero 原始推理使用 Flow UniPC scheduler；为了得到平滑动作，基线需要 16 个 denoising steps。
普通 DreamZero 继续从 4-step 硬降到 1-step 时，任务进度从 83% 降至 52%，说明直接减少采样步数确实有明显损失。DreamZero-Flash 通过解耦 video 与 action 的噪声 schedule，让模型在训练时就学会“从仍然很吵的 future video 中预测干净 action”，最终把 1-step 恢复到 74%，但可以看到仍然会对准确率有很大影响。

**DreamZero Few-Step / Flash 发展技术链**

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

1. **DiT Caching：16 个 solver steps 仍然存在，只是** 当相邻 velocity 的方向足够一致时，模型复用缓存结果，平均只执行约 4 次真正的 DiT forward。论文称其对视频与动作质量的影响很小。另外 DiT cache 还有点小问题，因为要计算相邻 steps score，也有 cost 貌似？？
2. **4-step sampling：真的直接只运行 4 个 denoising steps。** Table 3 中 DreamZero 4-step 的 83% 指的是这种设置，不是 DiT Cache 的“约 4 次 forward”。


### 2.2 为什么不用 DMD？

DMD在image和video领域能做到50-steps蒸馏到4-steps且几乎没有太大损失，获得了很好的效果。但是在这里，本论文没有讨论 DMD，也没有提供相关对比，因此不能从现有证据得出“DMD 更好”或“DMD 不适用”的结论。

但是DreamZero-Flash 的 1-step 虽然约快 2.3 倍，但 74%的准确率算是掉的很多的了，原先强行拉到1-steps更差，这还是finetune之后的了。我估计使用DMD应该会更好，但是有个concern是joint predict尤其是token数量不公平情况下优化会有点问题，比如video-audio这种联合优化的DMD没做的太好，例如：omniforcing这种做了简单尝试。

- NOTE：在 Dyna-2 里面已经验证了 2-steps DMD 效果还挺好的。。但是 2 步相比于 1 步还是翻倍的 cost 增长。

## 我的判断

这篇论文还是个很好的baseline，证明了WAM借助VDM prior jointly predict action的优势，不是用大量数据学习一个任务，而是借助video prior，训练VDM掌握的知识和action之间的联系，学到了这样的能力就有很强的transfer特性，大大提升了模型的泛化性。

这样的formulation方式确实很合理，而且容易scaling，随着VDM效果越来越好(model size和data的scaling)，WAM的效果也可以随之scaling。

但是后续优化可能是速度、AR推理的优化还需要提升。


## 下次只看这些

1. VLA到WAM各自有什么优劣？DreamZero是如何分析的？
2. 论文证明了哪些重要结论，DreamZero和以往WAM有什么核心不同？
3. 6个benchmark上证明的泛化能力很强，更重要的是：任务迁移能力、跨具身的迁移能力更强？
4. 几个关键问题、和局限疑问的复习和思考？是否有更新的想法？
