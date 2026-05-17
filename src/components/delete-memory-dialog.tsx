"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteMemoryDialog({
  cardId,
  onDeleted,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  variant = "icon",
}: {
  cardId: string;
  onDeleted?: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isControlled =
    controlledOpen !== undefined &&
    typeof controlledOnOpenChange === "function";
  const open = isControlled ? controlledOpen : internalOpen;
  function setOpen(value: boolean) {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  }

  function handleDelete() {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch(`/api/memory-cards/${cardId}`, { method: "DELETE" })
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(payload?.error ?? "删除失败，请重试。");
          }

          setOpen(false);
          if (onDeleted) {
            onDeleted();
          } else {
            router.push("/inbox");
            router.refresh();
          }
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
          setPending(false);
        });
    });
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPending(false);
          setStatusMessage(null);
        }
      }}
      open={open}
    >
      {!isControlled ? (
        <DialogTrigger asChild>
          {variant === "icon" ? (
            <Button size="sm" title="删除" variant="ghost">
              <Trash2Icon className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="destructive">
              <Trash2Icon className="h-4 w-4" />
              删除记忆
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除记忆</DialogTitle>
          <DialogDescription>
            此操作不可撤销，将同时删除原始来源、消化结果和关联数据。
          </DialogDescription>
        </DialogHeader>
        {statusMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => setOpen(false)}
            variant="outline"
          >
            取消
          </Button>
          <Button
            disabled={pending}
            onClick={handleDelete}
            variant="destructive"
          >
            {pending ? "删除中..." : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
