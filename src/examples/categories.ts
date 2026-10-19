// ============================================================
// 案例分类定义
// 顺序 = 侧边栏导航分组顺序（学习/查阅顺序）
// ============================================================

/** 分类信息 */
export interface Category {
  /** 分类 id，对应 src/examples/<category>/ 目录名 */
  id: string
  /** 分类展示名（中文） */
  name: string
}

/** 全部分类（新增分类在此追加即可，顺序即导航顺序） */
export const categories: Category[] = [
  { id: 'performance', name: '性能监控' },
  { id: 'observer', name: '观察者' },
  { id: 'virtual', name: '虚拟渲染' },
  { id: 'vue3', name: 'Vue 3 API' },
]
