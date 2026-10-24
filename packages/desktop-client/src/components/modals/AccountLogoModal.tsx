import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useUpdateAccountMutation } from '#accounts';
import { AccountLogoPicker } from '#components/accounts/AccountLogo';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { useAccount } from '#hooks/useAccount';

type AccountLogoModalProps = {
  accountId: AccountEntity['id'];
};

export function AccountLogoModal({ accountId }: AccountLogoModalProps) {
  const { t } = useTranslation();
  const account = useAccount(accountId);
  const updateAccount = useUpdateAccountMutation();
  const [logo, setLogo] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (logo === undefined && account) {
      setLogo(account.logo ?? null);
    }
  }, [account, logo]);

  return (
    <Modal name="account-logo">
      {({ state }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Account logo')} shrinkOnOverflow />}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ gap: 16 }}>
            <AccountLogoPicker
              value={logo ?? account?.logo ?? null}
              onChange={setLogo}
            />
            <ModalButtons>
              <Button onPress={() => state.close()}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                isDisabled={
                  !account ||
                  logo === undefined ||
                  logo === (account.logo ?? null) ||
                  updateAccount.isPending
                }
                onPress={() =>
                  updateAccount.mutate(
                    { account: { id: accountId, logo } },
                    { onSuccess: () => state.close() },
                  )
                }
              >
                <Trans>Save</Trans>
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
