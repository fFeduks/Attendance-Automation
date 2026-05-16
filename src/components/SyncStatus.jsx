import React from 'react';
import { Cloud, HardDrive, Loader2, WifiOff } from 'lucide-react';

const STATUS_CONFIG = {
  synced: {
    label:     'Bulutla Senkronize',
    className: 'badge-synced',
    Icon:      Cloud,
  },
  local: {
    label:     'Veriler Yerelde',
    className: 'badge-local',
    Icon:      HardDrive,
  },
  syncing: {
    label:     'Senkronize Ediliyor...',
    className: 'badge-syncing',
    Icon:      Loader2,
  },
  error: {
    label:     'Senkronizasyon Hatası',
    className: 'badge-local',
    Icon:      WifiOff,
  },
};

export default function SyncStatus({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.local;
  const { label, className, Icon } = cfg;

  return (
    <span className={className} aria-live="polite">
      <Icon
        size={12}
        className={status === 'syncing' ? 'animate-spin' : ''}
      />
      {label}
    </span>
  );
}
