import { Link } from "react-router";
import { MarbleAvatar } from "./MarbleAvatar";
import type { StoredJob } from "~/hooks/useJobHistory";

interface OrdersTableProps {
  jobs: StoredJob[];
}

export function OrdersTable({ jobs }: OrdersTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-text-2 text-sm leading-relaxed">
        <p>
          You haven't hired anyone yet.
          <br />
          Find an agent on the marketplace.
        </p>
        <div className="flex gap-3 mt-5 justify-center">
          <Link to="/">
            <button className="btn btn-primary">Browse Marketplace</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {jobs.map((j) => (
        <Link
          key={j.jobEventId}
          to="/"
          className="flex items-center gap-3 p-3 rounded-[10px] border border-border mb-2 cursor-pointer no-underline text-text hover:bg-surface-2"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden">
            {j.agentPicture ? (
              <img
                src={j.agentPicture}
                alt={j.agentName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <MarbleAvatar name={j.agentName} size={40} />
            )}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">{j.agentName}</div>
            <div className="text-xs text-text-2">
              {j.capability} · {j.status}
            </div>
          </div>
          <div className="text-xs text-text-2">
            {new Date(j.createdAt).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
