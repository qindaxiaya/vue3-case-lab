// ============================================================
// 树节点数据结构（递归类型）
// ============================================================

/** 树节点：children 可选，递归嵌套 */
export interface TreeNodeData {
  label: string
  /** 节点类型标记（dir / vue / ts，用于插槽选图标） */
  kind?: string
  children?: TreeNodeData[]
}
