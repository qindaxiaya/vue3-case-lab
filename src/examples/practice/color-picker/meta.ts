// ============================================================
// 案例元数据：取色器
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'color-picker',
  title: '取色器 Color Picker',
  difficulty: 'intermediate',
  tags: ['HSV', 'EyeDropper', 'Clipboard'],
  summary: 'CSS 渐变叠出 HSV 面板，HEX/RGB/HSL 一键复制，支持原生屏幕吸管',
  sell: '纯 CSS 画 HSV 面板，三格式复制 + 原生吸管',
  explain: {
    situation:
      '要做主题色选择器：能拖着选颜色，显示 HEX / RGB / HSL，最好还能直接吸屏幕上的颜色。你准备上 canvas，发现还要自己画渐变。',
    background:
      '色板不用 canvas：横向一条色相渐变，纵向叠一层「白到透明 → 黑」的渐变，就是 HSV 面板。拖动位置换算成 HSV，再转成 HEX/RGB/HSL。Chrome 还提供 EyeDropper，能直接吸屏幕任意位置。',
    action:
      '案例用纯 CSS 渐变画色板，拖动实时输出三种格式并一键复制；支持原生吸管，不支持的浏览器给出提示。',
    conclusion:
      '记住：能 CSS 就别 canvas。EyeDropper 只有 Chromium 系支持，用之前先检测，做好降级。',
  },
} satisfies CaseMeta
