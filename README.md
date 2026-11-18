# 搭把手 · 校园跑腿互助

[打开校园互助 Demo](https://mikexinhuanxi.github.io/my-site/)

“搭把手”是一个中文静态演示。学生可以发布代取、代买和座位互助任务，按类别、地点和截止时间找单，并跟进交接和信用记录。

## 前置调研与设计

| 公开资料 | 反映的问题 | Demo 的设计 |
| --- | --- | --- |
| 北京邮电大学后勤部在 2025 年购物季提到课务冲突、快件滞留与取件凭证准备，并建议无法到场时委托同学代领。[北邮后勤部倡议](https://hq.bupt.edu.cn/info/1010/1131.htm) | 驿站取件有时间要求，交给同学代取还需交接信息。 | 广场先显示驿站、目的地和截止时间。详情补充件数、大小和交接方式，演示取件码向发布者和接单者显示。 |
| 北师大珠海分校《励耘报》2017 年报道援引 176 份有效问卷，代寄取快递、代买物品、代拿外卖排在前三。受访同学提到会在空闲且顺路时接单。[校报报道转载](https://www.gdgxxbw.com/show_mobile/1369.html) | 同学在决定是否接单前需要知道顺不顺路、买什么以及涉及多少金额。 | 将路线和感谢费放在列表中，代买表单分开填写规格、数量、商品预算和感谢费。 |
| 厦门大学图书馆 2025 年预约选座服务响应 125 万余次。山西师大图书馆读者规则要求阅览座位随来随用，并遵循预约制度。[厦大年度数据报告](https://library.xmu.edu.cn/info/6591/15588835.htm) · [山西师大读者规则](https://tsg.sxnu.edu.cn/info/1011/2659.htm) | 找座和看空位有明确场景，具体能否预约或留座由场馆规定。 | 座位互助默认帮看空座，交付时写楼层、区域和时间。活动留座需要确认主办方许可，并填写短时留座的时长。 |
| 2026 年一项校园快递研究用 612 份便利样本评估校园快递。包裹完整、取件便利、信息及时和隐私保护均属于表现较弱的指标。[校园快递服务研究](https://www.mdpi.com/2079-8954/14/8/978) | 接单前需要知道怎么交接，双方需要看到交付状态。 | 使用可见的任务进度、交付说明和发布者确认。确认完成后给接单者 10 信用分。 |

这些材料涉及不同学校和时间。校报的排序仅代表该次调查，选座响应是服务量。信用分值与确认规则是演示设定，尚无目标校园试用数据。

## 演示步骤

1. 以小林身份打开「身份与信用」，点击「填入演示邮箱」并完成验证码验证。验证后即可发布任务，也可以从发单或接单弹窗进入验证。
2. 首次绑定芝麻信用时，样例芝麻分成为初始信用分。小林的样例分为 718，加上示例任务已获得的 10 分，校内信用为 728 分。
3. 发布一个任务，切换到阿周，验证阿周的学生邮箱后接单。接单前完成邮箱验证可以直接返回任务。
4. 接单者提交交付说明。切回发布者，在「我发布的」确认完成。每项已确认的任务对应一条 +10 分校内信用记录。

在同一浏览器内切换演示身份。通过 `localStorage` 保存每个身份的绑定状态、首次设定的初始分和任务数据，当前身份保存在标签页的 `sessionStorage`。演示邮箱只接受预置的 `students.donghu.example` 地址，验证码在本页显示，芝麻分为预置样例。初始分待设定时，信用明细会展示已经获得的任务积分。

真实接入需要学校邮箱发信与服务端验证码校验，以及申请可用的芝麻信用接入能力和取得用户授权。[芝麻信用官方说明](https://render.alipay.com/p/yuyan/180020010001201259/zhima/noauth.htm?target=credit)

## 顺路找任务

在任务广场选起点、终点，点「查找顺路任务」。系统用演示校区的步行路网比较直达距离和依次经过任务取件点、交接点的距离，筛出方向合适且额外步行不超过 200 米的待接任务。座位互助只需经过一个地点。任务地点可以使用校区地点及其常用写法，例如「松柏苑 6 栋一楼」。

点「试用示例路线」可体验北门菜鸟驿站到松柏苑 6 栋的 790 米路线。北门取快递和二食堂代买都在沿途，去图书馆二楼看空座约需多走 140 米。当前没有可接任务时，页面会用预置样例展示匹配结果。

## 运行与部署

在仓库根目录运行 `python3 -m http.server 8000`，访问 `http://localhost:8000/`。无需安装依赖。

GitHub Pages 继续从仓库的 `main` 分支根目录发布。入口是 `index.html`，页面样式在 `styles.css`，任务状态和信用规则在 `domain.js`。首页插画由内置 ImageGen 生成，保存在 [assets/campus-ride.webp](./assets/campus-ride.webp)。

<details>
<summary>插画提示词</summary>

Create a single horizontal 3:2 transparent PNG cutout for the right half of a polished Chinese university student errands dashboard hero. A crisp, tactile 3D miniature of an East Asian university student in a warm yellow jacket and white sneakers riding a mint-green step-through bicycle, open cheerful youthful face in three-quarter view, black hair, a violet backpack and a securely placed little brown cardboard parcel in the front basket. A few secondary elements form one balanced vignette: a lilac location pin gently hovering behind, a small rounded cream campus gate and one stylized green shrub in the back, all resting just above a very shallow curved lavender path. Genuine alpha around the entire vignette and open negative space between objects with no rectangular backdrop. Premium soft molded clay / matte vinyl editorial illustration, friendly adult proportions, three-quarter side view, naturally detailed bicycle with two whole wheels, vibrant electric iris, mint and butter yellow accents, soft formed shadows, fine surface quality, legible silhouettes at 430 px. The scene is centered, framed generously with every part visible and fits horizontally. No words, text, symbols on parcel, lettering, interfaces, badges, watermark, solid sky or scenery outside the vignette.

</details>
