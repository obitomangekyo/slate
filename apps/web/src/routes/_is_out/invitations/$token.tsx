import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { Button, buttonVariants } from "#/components/ui/button";
import { toastManager } from "#/components/ui/toast";
import { api } from "#/lib/api";
import { authQueryOptions } from "#/lib/auth";

type InvitationPreview = {
  slateId: string;
  slateTitle: string;
  isPublic: boolean;
  role: "editor" | "viewer";
  invitedBy: string;
};

function invitationQueryOptions(token: string) {
  return {
    queryKey: ["invitations", token] as const,
    queryFn: async () => {
      const { data } = await api.get<{ invitation: InvitationPreview }>(
        `/slates/invitations/${token}`,
      );
      return data.invitation;
    },
  };
}

export const Route = createFileRoute("/_is_out/invitations/$token")({
  loader: ({ context, params }) =>
    context.queryClient.query({ ...invitationQueryOptions(params.token), staleTime: "static" }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.slateTitle ?? "Slate invitation"} · Slate` }],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = Route.useParams();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: invitation } = useSuspenseQuery(invitationQueryOptions(token));
  const { data: user } = useSuspenseQuery(authQueryOptions);
  const acceptInvite = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ slateId: string }>(`/slates/invitations/${token}/accept`);
      return data.slateId;
    },
    onSuccess: async (slateId) => {
      toastManager.add({ type: "success", title: "You joined the slate" });
      // Drop an anonymous preview so the board route reloads the collaborator's permissions.
      queryClient.removeQueries({ queryKey: ["slates", slateId] });
      await navigate({ to: "/s/$slateId", params: { slateId } });
    },
    onError: () => {
      toastManager.add({
        type: "error",
        title: "Could not accept invitation",
        description: "Sign in with the invited email address, then try again.",
      });
    },
  });

  const loginSearch = useMemo(() => ({ redirect: `/invitations/${token}` }), [token]);
  const previewParams = useMemo(() => ({ slateId: invitation.slateId }), [invitation.slateId]);

  const handleAcceptInvite = useCallback(
    async () => await acceptInvite.mutateAsync(),
    [acceptInvite],
  );

  return (
    <section className="auth-card border-line bg-paper-raised grid gap-5 rounded-sm border p-6 shadow-lg">
      <div className="grid gap-2">
        <p className="text-mineral text-xs font-semibold tracking-[0.16em] uppercase">
          Slate invitation
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{invitation.slateTitle}</h1>
        <p className="text-muted text-sm">
          {invitation.invitedBy} invited you to{" "}
          {invitation.role === "viewer" ? "view" : "collaborate on"} this slate.
        </p>
      </div>

      {invitation.isPublic && (
        <div className="grid gap-2">
          <p className="text-muted text-sm">
            This slate is public, so you can look around before joining.
          </p>
          <Link
            to="/s/$slateId"
            params={previewParams}
            className={buttonVariants({ variant: "outline" })}
          >
            Preview public slate
          </Link>
        </div>
      )}

      {user ? (
        <Button disabled={acceptInvite.isPending} onClick={handleAcceptInvite}>
          {acceptInvite.isPending ? "Joining..." : "Accept invitation"}
        </Button>
      ) : (
        <Link to="/login" search={loginSearch} className={buttonVariants()}>
          Sign in to accept
        </Link>
      )}
    </section>
  );
}
