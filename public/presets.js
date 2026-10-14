/* 社保码 · 三色预设（前台说明卡与管理后台共用） */
window.SHEBAO_PRESETS = {
  green: {
    label: '绿色码 · 通行',
    tag: '可正常通行',
    state: '正常',
    icon: '✓',
    desc: '您的社保状态正常，可通行',
    reasonsLabel: '',
    reasons: ['按时缴纳社保', '账户状态正常', '享受各项社保待遇'],
    footerNote: '',
  },
  yellow: {
    label: '黄色码 · 限行',
    tag: '需尽快处理',
    state: '注意',
    icon: '!',
    desc: '您的社保存在异常，请尽快处理',
    reasonsLabel: '可能原因',
    reasons: ['缴费逾期', '信息不一致', '待审核状态'],
    footerNote: '部分场所限行',
  },
  red: {
    label: '红色码 · 禁止通行',
    tag: '暂无法通行',
    state: '禁止通行',
    icon: '!',
    desc: '您的社保状态异常，暂无法通行',
    reasonsLabel: '可能原因',
    reasons: ['断缴超过规定期限', '参保状态异常', '涉及违规行为'],
    footerNote: '禁止进入公共场所',
  },
};
