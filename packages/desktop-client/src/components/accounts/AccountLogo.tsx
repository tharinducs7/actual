import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const LOGO_SIZE = 96;

type AccountLogoProps = {
  logo?: string | null;
  name: string;
  size?: number;
};

export function AccountLogo({ logo, name, size = 20 }: AccountLogoProps) {
  if (!logo) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const initials =
      words.length > 1
        ? words
            .slice(0, 2)
            .map(word => Array.from(word)[0])
            .join('')
        : Array.from(words[0] ?? '')
            .slice(0, 2)
            .join('') || '?';

    return (
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          backgroundColor: theme.sidebarItemBackgroundHover,
          color: theme.sidebarItemText,
          fontSize: Math.max(9, size * 0.45),
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {initials.toLocaleUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={logo}
      alt=""
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: 'contain',
        borderRadius: '50%',
      }}
    />
  );
}

type AccountLogoPickerProps = {
  value: string | null;
  onChange: (logo: string | null) => void;
};

export function AccountLogoPicker({ value, onChange }: AccountLogoPickerProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError(t('Choose a PNG, JPEG, or WebP image.'));
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setError(t('Choose an image smaller than 10 MB.'));
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(
          1,
          LOGO_SIZE / Math.max(bitmap.width, bitmap.height),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Could not process this image.');
        }

        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL('image/webp', 0.85));
        setError(null);
      } finally {
        bitmap.close();
      }
    } catch {
      setError(t('Could not read this image. Choose another file.'));
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {value && (
          <AccountLogo logo={value} name={t('Account logo')} size={32} />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        <Button onPress={() => inputRef.current?.click()}>
          {value ? <Trans>Change image</Trans> : <Trans>Upload image</Trans>}
        </Button>
        {value && (
          <Button
            variant="bare"
            onPress={() => {
              onChange(null);
              setError(null);
            }}
          >
            <Trans>Remove</Trans>
          </Button>
        )}
      </View>
      {error && <FormError>{error}</FormError>}
    </View>
  );
}
