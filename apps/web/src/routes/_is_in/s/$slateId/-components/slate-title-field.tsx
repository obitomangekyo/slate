import { zodResolver } from "@hookform/resolvers/zod";
import { MAX_SLATE_TITLE_LENGTH, MIN_SLATE_TITLE_LENGTH } from "@slate/shared";
import { Check, Hourglass, WarningTriangle } from "iconoir-react";
import { type ChangeEvent, useCallback, useEffect, useRef } from "react";
import {
  Controller,
  type ControllerProps,
  type ControllerRenderProps,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "#/components/ui/input-group";
import { useUpdateSlateTitleMutation } from "#/lib/slates";

const SlateTitleSchema = z.object({
  title: z.string().min(MIN_SLATE_TITLE_LENGTH).max(MAX_SLATE_TITLE_LENGTH),
});

type SlateTitleValues = { title: string };
type SlateTitleInputProps = {
  field: ControllerRenderProps<SlateTitleValues, "title">;
  canEdit: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  scheduleTitleSave: (title: string) => void;
};

function SlateTitleInput({
  field,
  canEdit,
  isPending,
  isError,
  isSuccess,
  scheduleTitleSave,
}: SlateTitleInputProps) {
  const { onChange, value } = field;
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event);
      scheduleTitleSave(event.target.value);
    },
    [onChange, scheduleTitleSave],
  );
  const retryTitleSave = useCallback(() => scheduleTitleSave(value), [scheduleTitleSave, value]);

  return (
    <InputGroup className="border-line bg-paper-raised text-ink hover:border-mineral hover:bg-paper pointer-events-auto mr-auto w-2/3 max-w-xs">
      <InputGroupInput
        {...field}
        value={field.value}
        onChange={handleChange}
        aria-label="Slate title"
        disabled={!canEdit}
      />
      {(isPending || isError || isSuccess) && (
        <InputGroupAddon align="inline-end">
          {isPending ? (
            <output aria-label="Saving title" aria-live="polite">
              <Hourglass
                aria-hidden="true"
                className="animate-hourglass-flip text-muted motion-reduce:animate-none"
              />
            </output>
          ) : isError ? (
            <InputGroupButton
              type="button"
              aria-label="Retry title save"
              onClick={retryTitleSave}
              className="text-clay"
            >
              <WarningTriangle aria-hidden="true" />
            </InputGroupButton>
          ) : (
            <Check className="text-mineral" aria-label="Title saved" />
          )}
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export function SlateTitleField({
  slateId,
  title,
  canEdit,
}: {
  slateId: string;
  title: string;
  canEdit: boolean;
}) {
  const updateTitle = useUpdateSlateTitleMutation();
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      // Cancel a pending save when leaving this board so it cannot update an old route.
      if (titleTimer.current) clearTimeout(titleTimer.current);
    },
    [],
  );

  const { control } = useForm<SlateTitleValues>({
    resolver: zodResolver(SlateTitleSchema),
    defaultValues: { title },
  });

  const scheduleTitleSave = useCallback(
    (nextTitle: string) => {
      if (!nextTitle || nextTitle === title) return;
      if (titleTimer.current) clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(async () => {
        await updateTitle.mutateAsync(
          { slateId, title: nextTitle },
          {
            onSuccess() {
              setTimeout(() => {
                updateTitle.reset();
              }, 3_000);
            },
          },
        );
      }, 750);
    },
    [slateId, title, updateTitle],
  );

  const renderTitleInput = useCallback<ControllerProps<SlateTitleValues>["render"]>(
    ({ field }) => (
      <SlateTitleInput
        field={field}
        canEdit={canEdit}
        isPending={updateTitle.isPending}
        isError={updateTitle.isError}
        isSuccess={updateTitle.isSuccess}
        scheduleTitleSave={scheduleTitleSave}
      />
    ),
    [canEdit, scheduleTitleSave, updateTitle.isError, updateTitle.isPending, updateTitle.isSuccess],
  );

  return (
    <Controller control={control} name="title" disabled={!canEdit} render={renderTitleInput} />
  );
}
