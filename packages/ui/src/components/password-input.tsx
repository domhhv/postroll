'use client';

import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useState } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from '#components/input-group';

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, 'type'> & {
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup className={className}>
      <InputGroupInput {...props} type={visible ? 'text' : 'password'} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-xs"
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => {
            return setVisible((prev) => {
              return !prev;
            });
          }}
        >
          {visible ? <IconEye /> : <IconEyeOff />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
