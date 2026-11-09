// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { makeThread } from "@bb/test-helpers/domain-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadDeleteDialog } from "./ThreadDeleteDialog";

afterEach(cleanup);

describe("ThreadDeleteDialog", () => {
  it("identifies the selected thread, including its full title and ID", () => {
    const thread = makeThread({
      id: "thr_delete_target",
      title: "Investigate the sidebar confirmation dialog",
      titleFallback: "Original prompt",
    });

    render(
      <ThreadDeleteDialog
        target={{ threads: [thread] }}
        pending={false}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const targets = screen.getByRole("list", { name: "Threads to delete" });
    expect(within(targets).getByText(thread.title!)).toBeTruthy();
    expect(within(targets).getByText(thread.id)).toBeTruthy();
    expect(screen.queryByText("Original prompt")).toBeNull();
  });

  it("falls back to the prompt and identifies unnamed threads", () => {
    const threads = [
      makeThread({ id: "thr_prompt", title: null, titleFallback: "My prompt" }),
      makeThread({ id: "thr_untitled", title: " ", titleFallback: null }),
    ];

    render(
      <ThreadDeleteDialog
        target={{ threads }}
        pending={false}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("My prompt")).toBeTruthy();
    expect(screen.getByText("Thread thr_unti")).toBeTruthy();
    for (const thread of threads) {
      expect(screen.getByText(thread.id)).toBeTruthy();
    }
  });

  it("distinguishes equal titles in a bulk selection and retains cascade warnings", () => {
    const threads = [
      makeThread({ id: "thr_first", title: "Same title" }),
      makeThread({ id: "thr_second", title: "Same title" }),
    ];
    const target = { threads, childThreadCount: 3 };
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ThreadDeleteDialog
        target={target}
        pending={false}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    threads.forEach((thread, index) => {
      expect(within(items[index]!).getByText("Same title")).toBeTruthy();
      expect(within(items[index]!).getByText(thread.id)).toBeTruthy();
    });
    expect(screen.getByRole("dialog").textContent).toContain(
      "Their 3 child threads will be deleted too. This action cannot be undone.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete 2 threads" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(target);
  });

  it("updates the displayed identity and confirmation together when the target changes", () => {
    const first = { threads: [makeThread({ title: "First thread" })] };
    const second = { threads: [makeThread({ title: "Second thread" })] };
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    const view = render(
      <ThreadDeleteDialog
        target={first}
        pending={false}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );

    view.rerender(
      <ThreadDeleteDialog
        target={second}
        pending={false}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByText("First thread")).toBeNull();
    expect(screen.getByText("Second thread")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(second);
  });

  it("keeps the identity visible while deletion is pending and prevents another confirmation", () => {
    const thread = makeThread({ title: "Pending deletion" });
    const onDelete = vi.fn();
    render(
      <ThreadDeleteDialog
        target={{ threads: [thread] }}
        pending
        onOpenChange={vi.fn()}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText(thread.title!)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
