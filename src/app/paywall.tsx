import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PaywallSheet, type PaywallSheetProps } from '@/components/PaywallSheet';
import { isDemoSeed } from '@/lib/prototype-review';
import { SafeAreaView, Text, View } from '@/tw';

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PrototypePaywallPage() {
  const params = useLocalSearchParams<{
    prototypeUi005Seed?: string;
    feature?: string;
  }>();
  const demoSeed = isDemoSeed(params.prototypeUi005Seed);
  const feature = pickParam(params.feature) ?? 'AI识别';
  const [paywallVisible, setPaywallVisible] = useState(demoSeed);

  if (demoSeed) {
    return (
      <div data-testid="home-screen" className="screen active" style={{ display: 'flex', position: 'relative' }}>
        <PaywallSheet
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          feature={feature as PaywallSheetProps['feature']}
          reviewSeed="prototypeUi005Seed=demo"
        />

        <div className="topbar">
          <span className="tb-app">结节档案</span>
          <div className="avatar-btn">人</div>
        </div>
        <div className="pstrip">
          <div className="chip is-on"><div className="chip-name">本人</div><div className="chip-sub">3个病灶</div></div>
          <div className="chip is-alert"><div className="chip-name">妈妈</div><div className="chip-sub">3天后!</div></div>
          <div className="chip is-off"><div className="chip-name">爸爸</div><div className="chip-sub">1个病灶</div></div>
          <div className="chip-add">+</div>
        </div>
        <div className="scrl">
          <div>
            <div className="alert-bar show-coral"><span className="ab-text-coral">妈妈的乳腺复查还有 3 天</span><button className="ab-btn coral">查看</button></div>
          </div>
          <div>
            <div className="sec">甲状腺</div>
            <div className="nc"><div className="nc-top"><div><div className="nc-name">左叶中下段结节</div><div className="nc-loc">甲状腺 · 左叶</div></div><span className="bdge b-up">▲ 增大</span></div><div className="nc-meta"><div><div className="mv">8.3mm</div><div className="ml">当前大小</div></div><div><div className="mv">TI-RADS 3</div><div className="ml">分级</div></div><div><div className="mv">▲17%</div><div className="ml">较基线</div></div></div><div className="nc-foot"><span className="fl">3次记录</span><span className="fr-soon">23天后复查</span></div></div>
            <div className="gap" />
            <div className="sec">乳腺</div>
            <div className="nc"><div className="nc-top"><div><div className="nc-name">右乳10点钟结节</div><div className="nc-loc">乳腺 · 右侧</div></div><span className="bdge b-ok">— 稳定</span></div><div className="nc-meta"><div><div className="mv">12mm</div><div className="ml">当前大小</div></div><div><div className="mv">BI-RADS 3</div><div className="ml">分级</div></div><div><div className="mv">—</div><div className="ml">较基线</div></div></div><div className="nc-foot"><span className="fl">2次记录</span><span className="fr">5个月后复查</span></div></div>
            <div className="gap" />
            <div className="sec">肺</div>
            <div className="nc"><div className="nc-top"><div><div className="nc-name">右上叶前段结节</div><div className="nc-loc">肺 · 右上叶</div></div><span className="bdge b-new">新建</span></div><div className="nc-meta"><div><div className="mv">6.2mm</div><div className="ml">当前大小</div></div><div><div className="mv">Lung-RADS 2</div><div className="ml">分级</div></div><div><div className="mv">—</div><div className="ml">较基线</div></div></div><div className="nc-foot"><span className="fl">1次记录</span><span className="fr">未设置提醒</span></div></div>
          </div>
          <div className="quota-row">
            <span className="quota-text">本月 AI 识别剩余 1 次</span>
            <button onClick={() => setPaywallVisible(true)} className="quota-btn">升级</button>
          </div>
          <div className="fab-row"><button className="fab">+ 新增检查</button></div>
        </div>
      </div>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-primary">会员权益预览</Text>
        <Text className="mt-2 text-center text-sm text-neutral-text">用于验证 paywall 完整用户态</Text>
      </View>
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature={feature as PaywallSheetProps['feature']}
        reviewSeed="prototypeUi005Seed=demo"
      />
    </SafeAreaView>
  );
}
