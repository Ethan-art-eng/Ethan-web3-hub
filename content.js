window.web3Content = {
  projects: [
    {
      name: "稳定币收益池观察",
      category: "理财",
      chain: "Multi-chain",
      status: "观察中",
      risk: "中高",
      summary: "记录不同稳定币收益来源、锁定期、合约托管和退出成本。",
      tags: ["Stablecoin", "DeFi", "收益来源"],
    },
    {
      name: "L2 积分生态",
      category: "空投",
      chain: "Layer2",
      status: "进行中",
      risk: "中",
      summary: "追踪交互任务、积分规则、跨链成本和女巫过滤风险。",
      tags: ["L2", "积分", "交互任务"],
    },
    {
      name: "流动性质押协议",
      category: "质押",
      chain: "Ethereum",
      status: "研究",
      risk: "中",
      summary: "关注验证者风险、流动性代币脱锚、提款周期和协议费用。",
      tags: ["Staking", "LST", "ETH"],
    },
    {
      name: "钱包安全工具包",
      category: "工具",
      chain: "All",
      status: "必备",
      risk: "低",
      summary: "整理授权检查、地址标签、钓鱼识别和多钱包隔离方案。",
      tags: ["钱包", "安全", "授权"],
    },
    {
      name: "RWA 收益项目",
      category: "理财",
      chain: "Multi-chain",
      status: "谨慎",
      risk: "高",
      summary: "重点核验底层资产、托管结构、赎回条件和法律实体。",
      tags: ["RWA", "稳定收益", "合规"],
    },
    {
      name: "新公链早期任务",
      category: "空投",
      chain: "Testnet",
      status: "低成本",
      risk: "中",
      summary: "适合用小号和低资金做任务记录，重点控制时间和 Gas 成本。",
      tags: ["Testnet", "Airdrop", "任务"],
    },
  ],

  airdrops: [
    {
      name: "测试网交互",
      cost: "低资金 / 高时间",
      progress: 62,
      note: "记录钱包、任务截图、Discord 身份和链上交易。",
    },
    {
      name: "主网积分",
      cost: "中资金 / 中成本",
      progress: 38,
      note: "重点看积分规则是否公开、是否存在交易量要求。",
    },
    {
      name: "生态任务",
      cost: "低资金 / 中时间",
      progress: 74,
      note: "适合批量整理任务链接，但要避免重复授权。",
    },
  ],

  courses: [
    {
      stage: "01",
      title: "钱包和安全",
      lessons: ["助记词与私钥", "硬件钱包", "授权撤销", "钓鱼识别"],
    },
    {
      stage: "02",
      title: "链上基础",
      lessons: ["Gas 和交易", "跨链桥", "区块浏览器", "合约交互"],
    },
    {
      stage: "03",
      title: "DeFi 入门",
      lessons: ["DEX", "借贷", "质押", "流动性池"],
    },
    {
      stage: "04",
      title: "项目研究",
      lessons: ["收益来源", "代币经济", "团队与融资", "风险复盘"],
    },
  ],

  tutorials: [
    {
      title: "Web3 新手第一课：钱包、链、Gas 和交易是什么",
      type: "入门",
      summary: "面向完全新手，先搞清楚链上操作的基本概念。",
      href: "#",
    },
    {
      title: "空投任务记录表：如何避免做完就忘",
      type: "空投",
      summary: "用固定字段记录项目、钱包、任务、成本和后续状态。",
      href: "#",
    },
    {
      title: "DeFi 理财项目怎么拆：收益、风险和退出",
      type: "理财",
      summary: "不要只看 APY，要拆收益来源、锁定期、合约和流动性。",
      href: "#",
    },
    {
      title: "钱包授权检查教程：哪些授权应该定期清理",
      type: "安全",
      summary: "建立定期检查授权的习惯，降低钓鱼和恶意合约风险。",
      href: "#",
    },
  ],
};
