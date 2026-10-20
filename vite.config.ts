import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 按需引入：模板里写 <el-input> 时自动补 import；
    // importStyle: false 表示组件样式统一由 main.ts 引入完整主题（含暗色变量），
    // 避免每个组件再插一份 style，也方便用站点 token 覆盖主题。
    Components({
      dts: 'src/components.d.ts',
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
  ],
})
