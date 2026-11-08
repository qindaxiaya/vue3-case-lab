// ============================================================
// 案例：form-dependency 表单联动
// 字段隐藏时清空，提交时只校验可见必填项
// ============================================================

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

// ============================================================
// 类型与初始表单
// ============================================================

type InvoiceType = 'personal' | 'company'
type DeliveryType = 'express' | 'pickup'

interface FormState {
  buyer: string
  invoiceType: InvoiceType
  companyName: string
  taxNo: string
  deliveryType: DeliveryType
  address: string
  pickupPoint: string
}

/** 地址和自提点都给默认值，切换配送方式时才能看出「清空」与「恢复」 */
function createForm(): FormState {
  return {
    buyer: '',
    invoiceType: 'personal',
    companyName: '',
    taxNo: '',
    deliveryType: 'express',
    address: '杭州市西湖区文三路 100 号',
    pickupPoint: '菜鸟驿站（文三路店）',
  }
}

const form = reactive<FormState>(createForm())
const clearedCount = ref(0)
const errorCount = ref(0)
const statusText = ref('待填写')

// ============================================================
// 显隐派生
// ============================================================

const isCompany = computed(() => form.invoiceType === 'company')
const isExpress = computed(() => form.deliveryType === 'express')
const isPickup = computed(() => form.deliveryType === 'pickup')

const visibleCompanyCount = computed(() => (isCompany.value ? 2 : 0))
const visibleAddressCount = computed(() => (isExpress.value ? 1 : 0))
const visiblePickupCount = computed(() => (isPickup.value ? 1 : 0))

/** 任何联动变化都先把上一次提交结果清掉，避免旧错误挂在新表单上 */
function resetFeedback(): void {
  errorCount.value = 0
  statusText.value = '待填写'
}

// ============================================================
// 联动与清空
// ============================================================

/** 只清真正有值的字段，清空计数才不会被空切换刷高 */
function clearCompanyFields(): void {
  if (form.companyName.trim()) {
    form.companyName = ''
    clearedCount.value += 1
  }
  if (form.taxNo.trim()) {
    form.taxNo = ''
    clearedCount.value += 1
  }
}

function setInvoiceType(value: string | number | boolean | undefined): void {
  if (value !== 'personal' && value !== 'company') return
  if (form.invoiceType === value) return
  form.invoiceType = value
  if (value === 'personal') clearCompanyFields()
  resetFeedback()
}

function setDeliveryType(value: string | number | boolean | undefined): void {
  if (value !== 'express' && value !== 'pickup') return
  if (form.deliveryType === value) return
  form.deliveryType = value
  if (value === 'pickup') {
    if (form.address.trim()) {
      form.address = ''
      clearedCount.value += 1
    }
  } else if (form.pickupPoint.trim()) {
    form.pickupPoint = ''
    clearedCount.value += 1
  }
  resetFeedback()
}

// ============================================================
// 校验与提交
// ============================================================

/** 只校验当前可见的字段：隐藏字段即使为空也不该拦住提交 */
function validate(): string[] {
  const errors: string[] = []
  if (!form.buyer.trim()) errors.push('购买人为必填项')

  if (isCompany.value) {
    if (!form.companyName.trim()) errors.push('企业名称为必填项')
    if (!form.taxNo.trim()) errors.push('税号为必填项')
  }

  if (isExpress.value) {
    if (!form.address.trim()) errors.push('收货地址为必填项')
  } else if (!form.pickupPoint.trim()) {
    errors.push('自提点为必填项')
  }

  return errors
}

function submit(): void {
  const errors = validate()
  errorCount.value = errors.length
  statusText.value = errors.length ? errors[0] : '提交成功'
}

function reset(): void {
  Object.assign(form, createForm())
  clearedCount.value = 0
  resetFeedback()
}
</script>

<template>
  <div class="fd-demo">
    <div class="fd-grid">
      <label class="fd-field">
        <span>购买人</span>
        <n-input
          v-model:value="form.buyer"
          data-field="buyer"
          placeholder="请输入购买人"
        />
      </label>

      <div class="fd-field">
        <span>发票类型</span>
        <n-radio-group
          :value="form.invoiceType"
          class="fd-invoice"
          size="small"
          @update:value="setInvoiceType"
        >
          <n-radio-button value="personal">
            个人
          </n-radio-button>
          <n-radio-button value="company">
            企业
          </n-radio-button>
        </n-radio-group>
      </div>

      <label
        v-if="isCompany"
        class="fd-field"
      >
        <span>企业名称</span>
        <n-input
          v-model:value="form.companyName"
          data-field="companyName"
          placeholder="请输入企业名称"
        />
      </label>

      <label
        v-if="isCompany"
        class="fd-field"
      >
        <span>税号</span>
        <n-input
          v-model:value="form.taxNo"
          data-field="taxNo"
          placeholder="请输入税号"
        />
      </label>

      <div class="fd-field">
        <span>配送方式</span>
        <n-radio-group
          :value="form.deliveryType"
          class="fd-delivery"
          size="small"
          @update:value="setDeliveryType"
        >
          <n-radio-button value="express">
            快递
          </n-radio-button>
          <n-radio-button value="pickup">
            自提
          </n-radio-button>
        </n-radio-group>
      </div>

      <label
        v-if="isExpress"
        class="fd-field"
      >
        <span>收货地址</span>
        <n-input
          v-model:value="form.address"
          data-field="address"
          placeholder="请输入收货地址"
        />
      </label>

      <label
        v-else
        class="fd-field"
      >
        <span>自提点</span>
        <n-input
          v-model:value="form.pickupPoint"
          data-field="pickupPoint"
          placeholder="请选择自提点"
        />
      </label>
    </div>

    <div class="fd-actions">
      <n-button
        type="primary"
        @click="submit"
      >
        提交
      </n-button>
      <n-button @click="reset">
        重置
      </n-button>
      <p class="fd-hint">
        隐藏的字段会被清空，提交时也只校验当前可见的必填项。
      </p>
    </div>

    <div class="fd-stats">
      <span>企业字段 <b data-stat="visible-company">{{ visibleCompanyCount }}</b></span>
      <span>地址 <b data-stat="visible-address">{{ visibleAddressCount }}</b></span>
      <span>自提点 <b data-stat="visible-pickup">{{ visiblePickupCount }}</b></span>
      <span>错误 <b data-stat="error-count">{{ errorCount }}</b></span>
      <span>已清空 <b data-stat="cleared-count">{{ clearedCount }}</b></span>
      <span class="fd-stat-wide">
        状态 <b data-stat="status-text">{{ statusText }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fd-demo {
  display: grid;
  gap: 0.75rem;
}

.fd-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem 0.75rem;
}

.fd-field {
  display: grid;
  gap: 0.3rem;
  align-content: start;
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.fd-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.fd-hint {
  margin: 0;
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
}

.fd-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.fd-stats b {
  color: var(--text);
}

.fd-stat-wide {
  margin-left: auto;
}

@media (max-width: 640px) {
  .fd-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .fd-stat-wide {
    margin-left: 0;
  }
}
</style>
