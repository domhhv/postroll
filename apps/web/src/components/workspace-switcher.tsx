'use client';

import type { WorkspaceList } from '@postroll/contracts';
import { Button } from '@postroll/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@postroll/ui/components/popover';
import { Separator } from '@postroll/ui/components/separator';
import { IconPlus, IconCheck, IconSelector } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { switchWorkspaceAction } from '#lib/actions';

import { CreateWorkspaceDialog } from './create-workspace-dialog';

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceList;
};

const itemBase =
  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:bg-muted disabled:opacity-60';

export function WorkspaceSwitcher({ activeWorkspaceId, workspaces }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const active =
    workspaces.find((workspace) => {
      return workspace.id === activeWorkspaceId;
    }) ??
    workspaces[0] ??
    null;

  function handleSwitch(workspaceId: string) {
    if (workspaceId === active?.id) {
      setOpen(false);

      return;
    }

    startTransition(async () => {
      await switchWorkspaceAction(workspaceId);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={(props) => {
            return (
              <Button
                {...props}
                variant="outline"
                aria-label="Switch workspace"
                className="max-w-48 justify-between gap-2"
              >
                <span className="truncate">{active?.name ?? 'Select workspace'}</span>
                <IconSelector className="size-4 shrink-0 opacity-60" />
              </Button>
            );
          }}
        />
        <PopoverContent align="start" className="w-64 gap-1 p-2">
          <div className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">Workspaces</div>
          {workspaces.map((workspace) => {
            const isActive = workspace.id === active?.id;

            return (
              <button
                type="button"
                key={workspace.id}
                disabled={pending}
                className={itemBase}
                onClick={() => {
                  return handleSwitch(workspace.id);
                }}
              >
                <IconCheck className={`size-4 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                <span className="flex-1 truncate text-left">{workspace.name}</span>
                <span className="text-muted-foreground text-xs">{workspace.role.toLowerCase()}</span>
              </button>
            );
          })}
          <Separator className="my-1 h-px" />
          <button
            type="button"
            className={itemBase}
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
          >
            <IconPlus className="size-4 shrink-0" />
            <span>Create workspace</span>
          </button>
        </PopoverContent>
      </Popover>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
