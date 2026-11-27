import { zodResolver } from "@hookform/resolvers/zod";
import { InviteSlateCollaboratorsInputSchema } from "@slate/shared";
import { useParams } from "@tanstack/react-router";
import { EditPencil, Eye, Plus, Xmark } from "iconoir-react";
import { type ComponentProps, type ReactElement, useCallback, useState } from "react";
import {
  type Control,
  Controller,
  type ControllerProps,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "#/components/ui/input-group";
import { Label } from "#/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { useInviteCollaboratorsMutation } from "#/lib/slates";

// React Hook Form keeps the array under `collaborators`; the shared schema normalizes each email.
const InviteFormSchema = z.object({ collaborators: InviteSlateCollaboratorsInputSchema });
type InviteFormInput = z.input<typeof InviteFormSchema>;
type InviteForm = z.output<typeof InviteFormSchema>;

const ROLES = {
  editor: { label: "Can edit", Icon: EditPencil },
  viewer: { label: "Can view only", Icon: Eye },
} as const;

type Role = keyof typeof ROLES;
type InviteEmailFieldName = `collaborators.${number}.email`;
type InviteRoleFieldName = `collaborators.${number}.role`;

type TooltipRender = Exclude<
  NonNullable<ComponentProps<typeof TooltipTrigger>["render"]>,
  ReactElement
>;
type PopoverRender = Exclude<
  NonNullable<ComponentProps<typeof PopoverTrigger>["render"]>,
  ReactElement
>;
type DialogRender = Exclude<
  NonNullable<ComponentProps<typeof DialogTrigger>["render"]>,
  ReactElement
>;

const renderRoleButton: PopoverRender = (props) => (
  <InputGroupButton {...props} type="button" variant="ghost" size="icon-xs" />
);

const renderRolePopoverTrigger: TooltipRender = (props) => (
  <PopoverTrigger {...props} render={renderRoleButton} />
);

const renderInviteDialogButton: DialogRender = (props) => <Button {...props} variant="outline" />;

type RolePopoverProps = {
  index: number;
  value?: Role;
  onChange: (value: Role) => void;
};

function RolePopover({ index, value = "viewer", onChange }: RolePopoverProps) {
  const { label, Icon } = ROLES[value];
  const handleChange = useCallback((next: string) => onChange(next as Role), [onChange]);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={renderRolePopoverTrigger}
          aria-label={`Access level for email ${index + 1}: ${label}`}
        >
          <Icon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-44 p-1">
        <RadioGroup value={value} onValueChange={handleChange}>
          {(Object.keys(ROLES) as Role[]).map((role) => (
            <Label
              key={role}
              htmlFor={`role-${index}-${role}`}
              className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <RadioGroupItem id={`role-${index}-${role}`} value={role} />
              {ROLES[role].label}
            </Label>
          ))}
        </RadioGroup>
      </PopoverContent>
    </Popover>
  );
}

type InviteEmailRowProps = {
  control: Control<InviteFormInput, unknown, InviteForm>;
  fieldId: string;
  index: number;
  fieldCount: number;
  remove: (index: number) => void;
};

function InviteEmailRow({ control, fieldId, index, fieldCount, remove }: InviteEmailRowProps) {
  const removeRow = useCallback(() => remove(index), [index, remove]);
  const renderRoleField = useCallback<
    ControllerProps<InviteFormInput, InviteRoleFieldName, InviteForm>["render"]
  >(
    ({ field: roleField }) => (
      <RolePopover
        index={index}
        value={roleField.value ?? "viewer"}
        onChange={roleField.onChange}
      />
    ),
    [index],
  );
  const renderEmailField = useCallback<
    ControllerProps<InviteFormInput, InviteEmailFieldName, InviteForm>["render"]
  >(
    ({ field: emailField, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={`invite-email-${fieldId}`} className="text-muted mb-1 block text-xs">
          Email address {index + 1}
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            {...emailField}
            id={`invite-email-${fieldId}`}
            type="email"
            autoComplete="email"
            aria-invalid={fieldState.invalid}
          />
          <InputGroupAddon align="inline-end">
            <Controller
              control={control}
              name={`collaborators.${index}.role`}
              render={renderRoleField}
            />
            {fieldCount > 1 && (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove email ${index + 1}`}
                onClick={removeRow}
              >
                <Xmark aria-hidden="true" />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
      </Field>
    ),
    [control, fieldCount, fieldId, index, removeRow, renderRoleField],
  );

  return (
    <Controller control={control} name={`collaborators.${index}.email`} render={renderEmailField} />
  );
}

type InviteCollaboratorsActionProps = {
  onInvited: () => void;
};

export function InviteCollaboratorsAction({ onInvited }: InviteCollaboratorsActionProps) {
  const { slateId } = useParams({ from: "/_is_in/s/$slateId/" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteCollaborators = useInviteCollaboratorsMutation(slateId);
  const inviteForm = useForm<InviteFormInput, unknown, InviteForm>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: { collaborators: [{ email: "", role: "viewer" }] },
  });
  const inviteFields = useFieldArray({ control: inviteForm.control, name: "collaborators" });
  const handleAddCollaborator = useCallback(() => {
    inviteFields.append({ email: "", role: "viewer" });
  }, [inviteFields]);

  const inviteByEmail = async (form: InviteForm) => {
    await inviteCollaborators.mutateAsync(form.collaborators, {
      onSettled(data) {
        const failures = data
          ?.filter((item) => !item.sent)
          .map((item) => ({ email: item.email, role: item.role }));

        if (failures?.length) {
          inviteForm.setValue("collaborators", failures);
          return;
        }

        inviteForm.reset({ collaborators: [{ email: "", role: "viewer" }] });
        setInviteOpen(false);
        onInvited();
      },
    });
  };

  return (
    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
      <DialogTrigger render={renderInviteDialogButton}>Invite collaborators</DialogTrigger>
      <DialogContent className="border-line bg-paper-raised text-ink rounded-sm border shadow-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite collaborators</DialogTitle>
          <DialogDescription>Send an invitation link to each email address.</DialogDescription>
        </DialogHeader>
        <form onSubmit={inviteForm.handleSubmit(inviteByEmail)} className="grid gap-3">
          {inviteFields.fields.map((field, index) => (
            <InviteEmailRow
              key={field.id}
              control={inviteForm.control}
              fieldId={field.id}
              index={index}
              fieldCount={inviteFields.fields.length}
              remove={inviteFields.remove}
            />
          ))}
          {inviteFields.fields.length < 20 && (
            <Button type="button" variant="ghost" onClick={handleAddCollaborator}>
              <Plus aria-hidden="true" /> Add another collaborator
            </Button>
          )}
          {inviteCollaborators.isError && (
            <Alert variant="destructive">
              <AlertTitle>Some invitations could not be sent</AlertTitle>
              <AlertDescription>Check the highlighted addresses and try again.</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="submit" disabled={inviteCollaborators.isPending}>
              {inviteCollaborators.isPending ? "Sending..." : "Send invitations"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
