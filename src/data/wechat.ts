export type EntryItem = {
  category: string;
  description: string;
  slug: string;
  title: string;
};

export const chatThreads = [
  {
    slug: 'chat-li-na',
    title: '李娜',
    subtitle: '晚上一起吃饭？我订了靠窗的位置。',
    meta: '09:42',
    unread: 2,
  },
  {
    slug: 'chat-product-team',
    title: '产品讨论群',
    subtitle: 'Alex：新版本提审时间改到周五。',
    meta: '08:15',
    unread: 6,
  },
  {
    slug: 'chat-dad',
    title: '爸爸',
    subtitle: '周末回来记得带充电器。',
    meta: '昨天',
    unread: 0,
  },
  {
    slug: 'chat-coffee',
    title: '咖啡搭子',
    subtitle: '今天还是老地方，十分钟后到。',
    meta: '周日',
    unread: 1,
  },
] as const;

export const contactEntrances = [
  { slug: 'new-friends', title: '新的朋友', subtitle: '验证消息与好友通知', leading: '新' },
  { slug: 'group-chats', title: '群聊', subtitle: '查看加入的群组', leading: '群' },
  { slug: 'tags', title: '标签', subtitle: '按分组管理联系人', leading: '签' },
  { slug: 'official-accounts', title: '公众号', subtitle: '常用内容入口占位', leading: '公' },
] as const;

export const contacts = [
  { slug: 'contact-amy', title: 'Amy', subtitle: '产品经理', leading: 'A' },
  { slug: 'contact-bob', title: 'Bob', subtitle: '设计师', leading: 'B' },
  { slug: 'contact-chen', title: '陈晨', subtitle: '前端工程师', leading: '陈' },
  { slug: 'contact-dora', title: 'Dora', subtitle: '运营', leading: 'D' },
] as const;

export const discoverEntries: readonly {
  leading: string;
  showDot?: boolean;
  slug: string;
  subtitle: string;
  title: string;
}[] = [
  { slug: 'moments', title: '朋友圈', subtitle: '朋友动态与图片流', leading: '圈', showDot: true },
  { slug: 'scan', title: '扫一扫', subtitle: '扫码、识物、网页入口', leading: '扫' },
  { slug: 'channels', title: '视频号', subtitle: '短视频与直播入口', leading: '视' },
  { slug: 'mini-programs', title: '小程序', subtitle: '最近使用与服务入口', leading: '程' },
] as const;

export const meEntries = [
  { slug: 'favorites', title: '收藏', subtitle: '文章、图片与链接', leading: '藏' },
  { slug: 'moments-me', title: '朋友圈', subtitle: '自己的内容与相册', leading: '圈' },
  { slug: 'cards', title: '卡包', subtitle: '会员卡与票券占位', leading: '卡' },
  { slug: 'stickers', title: '表情', subtitle: '已下载表情管理', leading: '表' },
  { slug: 'settings', title: '设置', subtitle: '账号、通知与通用', leading: '设' },
] as const;

const allEntries: EntryItem[] = [
  ...chatThreads.map((item) => ({
    category: '微信',
    description: item.subtitle,
    slug: item.slug,
    title: item.title,
  })),
  ...contactEntrances.map((item) => ({
    category: '通讯录',
    description: item.subtitle,
    slug: item.slug,
    title: item.title,
  })),
  ...contacts.map((item) => ({
    category: '联系人',
    description: item.subtitle,
    slug: item.slug,
    title: item.title,
  })),
  ...discoverEntries.map((item) => ({
    category: '发现',
    description: item.subtitle,
    slug: item.slug,
    title: item.title,
  })),
  ...meEntries.map((item) => ({
    category: '我',
    description: item.subtitle,
    slug: item.slug,
    title: item.title,
  })),
];

export const entryBySlug = Object.fromEntries(allEntries.map((item) => [item.slug, item])) as Record<
  string,
  EntryItem
>;
