import { ThreadDeleteDialogContent } from "./ThreadDeleteDialog";
import { makeThread } from "../../../.ladle/story-fixtures";
import { StoryCard, StoryRow } from "../../../.ladle/story-card";
import { DialogStage } from "../../../.ladle/story-dialog-stage";

export default {
  title: "dialogs/Thread Delete",
};

const noop = () => {};

const standardThread = makeThread();
const parentThread = makeThread({
  id: "thr_parent",
  title: "Frontend Parent",
  titleFallback: "Frontend Parent",
});

export function Thread() {
  return (
    <StoryCard>
      <StoryRow
        label="clean workspace"
        hint="basic confirm — no warnings, just 'cannot be undone'"
      >
        <DialogStage>
          <ThreadDeleteDialogContent
            target={{ threads: [standardThread] }}
            pending={false}
            onOpenChange={noop}
            onDelete={noop}
          />
        </DialogStage>
      </StoryRow>
      <StoryRow label="pending" hint="delete request in flight">
        <DialogStage>
          <ThreadDeleteDialogContent
            target={{ threads: [standardThread] }}
            pending
            onOpenChange={noop}
            onDelete={noop}
          />
        </DialogStage>
      </StoryRow>
    </StoryCard>
  );
}

export function Parent() {
  return (
    <StoryCard>
      <StoryRow
        label="no children, clean workspace"
        hint="same minimal confirm as a thread"
      >
        <DialogStage>
          <ThreadDeleteDialogContent
            target={{ threads: [parentThread] }}
            pending={false}
            onOpenChange={noop}
            onDelete={noop}
          />
        </DialogStage>
      </StoryRow>
      <StoryRow
        label="child threads"
        hint="N child threads require delete confirmation"
      >
        <DialogStage>
          <ThreadDeleteDialogContent
            target={{
              threads: [parentThread],
              childThreadCount: 3,
            }}
            pending={false}
            onOpenChange={noop}
            onDelete={noop}
          />
        </DialogStage>
      </StoryRow>
      <StoryRow
        label="single child"
        hint="same confirmation language with one child"
      >
        <DialogStage>
          <ThreadDeleteDialogContent
            target={{
              threads: [parentThread],
              childThreadCount: 1,
            }}
            pending={false}
            onOpenChange={noop}
            onDelete={noop}
          />
        </DialogStage>
      </StoryRow>
    </StoryCard>
  );
}

export function TargetIdentities() {
  const cases = [
    {
      label: "long title",
      threads: [
        makeThread({
          title:
            "Review the deployment plan and verify every release artifact before enabling the production rollout",
        }),
      ],
    },
    {
      label: "unbroken title",
      threads: [makeThread({ title: "x".repeat(200) })],
    },
    {
      label: "prompt fallback",
      threads: [
        makeThread({
          title: null,
          titleFallback: "Investigate the missing confirmation title",
        }),
      ],
    },
    {
      label: "unnamed thread",
      threads: [makeThread({ title: null, titleFallback: null })],
    },
    {
      label: "same titles and a scrollable bulk selection",
      threads: Array.from({ length: 12 }, (_, index) =>
        makeThread({ id: `thr_duplicate_${index}`, title: "Release notes" }),
      ),
    },
  ];

  return (
    <StoryCard>
      {cases.map(({ label, threads }) => (
        <StoryRow key={label} label={label}>
          <DialogStage>
            <ThreadDeleteDialogContent
              target={{ threads, childThreadCount: 2 }}
              pending={false}
              onOpenChange={noop}
              onDelete={noop}
            />
          </DialogStage>
        </StoryRow>
      ))}
    </StoryCard>
  );
}
