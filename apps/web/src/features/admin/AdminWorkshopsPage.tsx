import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, XCircle } from "lucide-react";
import { api } from "../../lib/api";

export function AdminWorkshopsPage() {
  const queryClient = useQueryClient();
  const workshops = useQuery({ queryKey: ["workshops"], queryFn: () => api.workshopApi.list() });
  const cancel = useMutation({
    mutationFn: (id: string) => api.workshopApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workshops"] })
  });

  return (
    <section>
      <div className="section-header">
        <h1>Admin workshops</h1>
        <Link className="button" to="/admin/workshops/new">
          <Plus size={18} /> New
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Room</th>
              <th>Seats</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {workshops.data?.map((workshop) => (
              <tr key={workshop.id}>
                <td>{workshop.title}</td>
                <td>{workshop.room.name}</td>
                <td>
                  {workshop.registeredCount}/{workshop.capacity}
                </td>
                <td>{workshop.status}</td>
                <td className="actions">
                  <Link className="icon-button" to={`/admin/workshops/${workshop.id}/edit`} title="Edit">
                    <Pencil size={16} />
                  </Link>
                  <button className="icon-button danger" onClick={() => cancel.mutate(workshop.id)} title="Cancel">
                    <XCircle size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
