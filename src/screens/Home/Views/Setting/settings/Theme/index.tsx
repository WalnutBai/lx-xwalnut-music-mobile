import { memo } from 'react'

import Section from '../../components/Section'
import Theme from './Theme'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
import Blur from "@/screens/Home/Views/Setting/settings/Theme/Blur.tsx";
import CustomBg from "@/screens/Home/Views/Setting/settings/Theme/CustomBg.tsx";
import PicOpacity from "@/screens/Home/Views/Setting/settings/Theme/PicOpacity.tsx";
import SectionOpacity from "@/screens/Home/Views/Setting/settings/Theme/SectionOpacity.tsx";
import SubContainerOpacity from "@/screens/Home/Views/Setting/settings/Theme/SubContainerOpacity.tsx";
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()
  return (
    <Section title={t('setting_theme')} sectionId="setting_theme">
      <Theme />
      <IsAutoTheme />
      <IsDynamicBg />
      <CustomBg />
      <PicOpacity />
      <Blur />
      <SectionOpacity />
      <SubContainerOpacity />
      <IsFontShadow />
    </Section>
  )
})
