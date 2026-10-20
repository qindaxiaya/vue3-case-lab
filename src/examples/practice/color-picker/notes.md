# 取色器 Color Picker

## 1. 现象与场景

要做一个取色器，用 RGB 三个滑块调颜色，越调越乱：改亮度三个值都要动，用户根本不知道怎么拖。

复现：拖动色相条与二维面板，HEX / RGB / HSL 三种格式同步更新；点「屏幕吸管取色」可直接取屏幕任意像素。

## 2. 原理

取色面板天然对应 HSV：色相（H）是一维色带，饱和度（S）和明度（V）是二维平面。用 RGB 建模会导致「改亮度要三通道联动」，交互不直观。

二维面板不用 canvas 逐像素重绘：底层放当前色相纯色，上面叠两层 CSS 渐变——左白右透表示饱和度，下黑上透表示明度。拖动时只把坐标换算成 S/V 百分比，零重绘成本。

## 3. 关键代码

```ts
const h = ref(238) // 色相 0~360
const s = ref(72)  // 饱和度 0~100
const v = ref(88)  // 明度 0~100

function updateFromPanel(e: PointerEvent, rect: DOMRect): void {
  // 1. 面板 x 映射饱和度，y 反向映射明度
  s.value = Math.round(((e.clientX - rect.left) / rect.width) * 100)
  v.value = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100)
}

function hsvToRgb(hh: number, ss: number, vv: number) {
  const c = (vv / 100) * (ss / 100)
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = vv / 100 - c
  // 2. 六个 60° 扇区各自决定 RGB 的排列
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x]
    : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

// 3. EyeDropper 是原生能力，用户按 Esc 会 reject
if ('EyeDropper' in window) {
  const { sRGBHex } = await new window.EyeDropper().open()
  applyHex(sRGBHex)
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 默认颜色 | #3f44e0 |
| RGB | rgb(63, 68, 224) |
| HSL | hsl(238, 72%, 56%) |
| 最近色板 | 最多 8 个（去重） |
| 三维联动 | 拖一次只改 S/V，H 不变 |

测量方式：Chrome headless 1200×900 打开案例读取默认三格式；拖动面板后观察 HEX/RGB/HSL 同步变化。三格式由同一组 HSV 推导，理论上应互相吻合（默认值四舍五入误差 ≤1）。

## 5. 追问与边界

**Q：为什么不直接存 HEX？**
HEX 无法表达「色相不变，只调明度」；面板交互需要 HSV 的可分解维度，显示时再转 HEX。

**Q：EyeDropper 兼容性？**
Chrome/Edge 支持，Firefox/Safari 不支持；必须做能力检测并保留手动取色。

**Q：需要色域管理或对比度检测怎么办？**
自建只适合基础取色；P3 色域、无障碍对比度、预设色板用 iro.js、vanilla-picker 等成熟库。

坑：面板高度算反（y 向下增大），会导致越往下越亮。边界：HSV 转 RGB 有浮点误差，展示前统一 `Math.round`；复制格式要和显示一致。
