import BuildWizard from '@/components/builder/BuildWizard.jsx';
import ControlPanel from '@/components/control-panel/ControlPanel.jsx';
import BuildAudit from '@/components/audit/BuildAudit.jsx';
import UpgradePlanner from '@/components/upgrade/UpgradePlanner.jsx';
import ReadmeContent from '@/components/readme/ReadmeContent.jsx';
import Marketplace from '@/components/marketplace/Marketplace.jsx';

export const WINDOW_REGISTRY = {
  'control-panel': {
    title: 'KOMPARE_CONTROL_PANEL.EXE',
    component: ControlPanel,
    defaultWidth: '600px'
  },
  'builder': {
    title: 'BUILD_WIZARD.EXE',
    component: BuildWizard,
    defaultWidth: '800px'
  },
  'upgrade': {
    title: 'UPGRADE_PLANNER.EXE',
    component: UpgradePlanner,
    defaultWidth: '800px'
  },
  'audit': {
    title: 'BUILD_AUDIT.EXE',
    component: BuildAudit,
    defaultWidth: '800px'
  },
  'readme': {
    title: 'README.TXT',
    component: ReadmeContent,
    defaultWidth: '600px'
  },
  'marketplace': {
    title: 'MARKETPLACE.EXE',
    component: Marketplace,
    defaultWidth: '500px'
  }
};
