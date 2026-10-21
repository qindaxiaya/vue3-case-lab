// ============================================================
// 案例分类定义
// 顺序 = 列表页分组与筛选 chips 顺序（学习/查阅顺序）
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
  // 入门分类在前：CSS / 浏览器基础是查阅顺序的最前面
  { id: 'css', name: 'CSS 技巧' },
  { id: 'basics', name: '浏览器基础' },
  { id: 'performance', name: '性能监控' },
  { id: 'observer', name: '观察者' },
  { id: 'virtual', name: '虚拟渲染' },
  { id: 'vue3', name: 'Vue 3 API' },
  { id: 'composables', name: '组合式函数' },
  { id: 'practice', name: '工程实践' },
]
