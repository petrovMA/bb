import { useLayoutEffect, useRef, useState } from "react";
import type { Thread } from "@bb/domain";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "@bb/shared-ui/confirm-delete-dialog";
import { formatChildThreadCount } from "@/lib/child-thread-copy";
import { getThreadDisplayTitle } from "@/lib/thread-title";

export interface ThreadDeleteDialogTarget {
  threads: readonly Thread[];
  childThreadCount?: number;
}

interface ThreadDeleteDialogProps<Target extends ThreadDeleteDialogTarget> {
  target: Target | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (target: Target) => void;
}

export function ThreadDeleteDialog<Target extends ThreadDeleteDialogTarget>({
  target,
  pending,
  onOpenChange,
  onDelete,
}: ThreadDeleteDialogProps<Target>) {
  return (
    <ConfirmDeleteDialog
      open={target !== null}
      onOpenChange={onOpenChange}
      onOpenAutoFocus={(event) => {
        const cancel =
          event.target instanceof HTMLElement
            ? event.target.querySelector<HTMLButtonElement>(
                "[data-confirm-delete-cancel]",
              )
            : null;
        if (cancel && !cancel.disabled) {
          event.preventDefault();
          cancel.focus();
        }
      }}
    >
      {target ? (
        <ThreadDeleteDialogContent
          target={target}
          pending={pending}
          onOpenChange={onOpenChange}
          onDelete={onDelete}
        />
      ) : null}
    </ConfirmDeleteDialog>
  );
}

function ThreadDeleteTargetList({ threads }: { threads: readonly Thread[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const list = listRef.current;
    if (!scroll || !list) return;
    const measure = () =>
      setScrollable(scroll.scrollHeight > scroll.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    observer.observe(list);
    return () => observer.disconnect();
  }, [threads]);

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Scroll selected threads"
      tabIndex={scrollable ? 0 : -1}
      className="max-h-48 overflow-y-auto"
    >
      <ul ref={listRef} aria-label="Threads to delete" className="space-y-2">
        {threads.map((thread) => (
          <li key={thread.id}>
            <span className="block break-words font-semibold text-foreground">
              {getThreadDisplayTitle(thread)}
            </span>
            <span className="block break-all font-mono text-xs text-muted-foreground">
              {thread.id}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ThreadDeleteDialogContentProps<
  Target extends ThreadDeleteDialogTarget,
> {
  target: Target;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (target: Target) => void;
}

export function ThreadDeleteDialogContent<
  Target extends ThreadDeleteDialogTarget,
>({
  target,
  pending,
  onOpenChange,
  onDelete,
}: ThreadDeleteDialogContentProps<Target>) {
  const single = target.threads.length === 1;
  const label = single ? "thread" : `${target.threads.length} threads`;

  return (
    <ConfirmDeleteDialogContent
      title={`Delete ${label}?`}
      description={
        <>
          {target.childThreadCount ? (
            <>
              {single ? "Its" : "Their"}{" "}
              <span className="font-semibold">
                {formatChildThreadCount(target.childThreadCount)}
              </span>{" "}
              will be deleted too.{" "}
            </>
          ) : null}
          This action cannot be undone.
        </>
      }
      confirmLabel={`Delete ${label}`}
      pending={pending}
      onConfirm={() => onDelete(target)}
      onCancel={() => onOpenChange(false)}
    >
      <ThreadDeleteTargetList threads={target.threads} />
    </ConfirmDeleteDialogContent>
  );
}
