// ============================================================
// 404 页面（未匹配任何路由）
// - 以前未知路径会被静默重定向到首页，用户不知道自己点错了
// - 这里给出明确提示 + 两条出路（回首页 / 去案例库）
// - 单独成页而不是弹窗：地址栏保留错误路径，方便排查失效链接
// ============================================================
<template>
  <div class="not-found">
    <p class="not-found-code">
      404
    </p>
    <h1 class="not-found-title">
      页面不存在
    </h1>
    <p class="not-found-desc">
      这条链接可能已经失效，或者案例被重命名了。
      你可以回首页，或直接去案例库按分类查找。
    </p>
    <div class="not-found-actions">
      <RouterLink
        class="btn-primary"
        to="/cases"
      >
        去案例库
      </RouterLink>
      <RouterLink
        class="btn-ghost"
        to="/"
      >
        回首页
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  width: 100%;
  max-width: 34rem;
  margin: 0 auto;
  padding: 5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

/* 大号数字：弱化为背景信息，不抢标题 */
.not-found-code {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 3.25rem;
  font-weight: 700;
  line-height: 1;
  color: var(--primary);
  opacity: 0.35;
}

.not-found-title {
  margin: 0;
  font-size: 1.5rem;
}

.not-found-desc {
  margin: 0 0 0.75rem;
  font-size: 0.92rem;
  line-height: 1.8;
  color: var(--text-secondary);
}

.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}

@media (max-width: 560px) {
  .not-found {
    padding: 3rem 1.25rem;
  }
}
</style>
