import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import type { PayeeEntity } from '@actual-app/core/types/models';

import { AccountLogoPicker } from '#components/accounts/AccountLogo';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { usePayee } from '#hooks/usePayee';
import { useUpdatePayeeLogoMutation } from '#payees';

type PayeeLogoModalProps = {
  payeeId: PayeeEntity['id'];
};

export function PayeeLogoModal({ payeeId }: PayeeLogoModalProps) {
  const { t } = useTranslation();
  const payee = usePayee(payeeId).data;
  const updatePayee = useUpdatePayeeLogoMutation();
  const [logo, setLogo] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (logo === undefined && payee) {
      setLogo(payee.logo ?? null);
    }
  }, [payee, logo]);

  return (
    <Modal name="payee-logo">
      {({ state }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Payee logo')} shrinkOnOverflow />}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ gap: 16 }}>
            <AccountLogoPicker
              value={logo === undefined ? (payee?.logo ?? null) : logo}
              name={payee?.name ?? t('Payee logo')}
              onChange={setLogo}
            />
            <ModalButtons>
              <Button onPress={() => state.close()}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                isDisabled={
                  !payee ||
                  logo === undefined ||
                  logo === (payee.logo ?? null) ||
                  updatePayee.isPending
                }
                onPress={() =>
                  updatePayee.mutate(
                    { id: payeeId, logo },
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
