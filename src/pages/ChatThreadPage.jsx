import { Navigate, useParams } from "react-router-dom";
import { AsyncBoundary } from "../components/ui/Misc";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";

// /chat/client/:clientId — a client's chat (made when first opened), then
// the chat itself (pages/ChatPage.jsx).
export function ClientChatRedirect() {
  const { clientId } = useParams();
  const state = useAsync(() => api.clientChat(clientId), [clientId]);
  return <AsyncBoundary state={state}>{(conv) => <Navigate to={`/chat/${conv.id}`} replace />}</AsyncBoundary>;
}
