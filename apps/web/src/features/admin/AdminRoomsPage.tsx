import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Edit, FileUp, Save, X } from "lucide-react";
import { RoomStatus, type RoomDto } from "@unihub/shared-types";
import { api } from "../../lib/api";

interface RoomFormState {
  name: string;
  capacity: string;
  status: RoomStatus;
  layoutUrl: string;
}

const emptyForm: RoomFormState = {
  name: "",
  capacity: "40",
  status: RoomStatus.ACTIVE,
  layoutUrl: ""
};

export function AdminRoomsPage() {
  const queryClient = useQueryClient();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api.roomApi.list() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomFormState>(emptyForm);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        capacity: Number(form.capacity),
        status: form.status,
        layoutUrl: form.layoutUrl.trim() ? form.layoutUrl.trim() : null
      };
      const room = editingId ? await api.roomApi.update(editingId, payload) : await api.roomApi.create(payload);
      if (layoutFile) {
        return api.roomApi.uploadLayout(room.id, {
          fileName: layoutFile.name,
          contentType: layoutFile.type || "image/png",
          size: layoutFile.size
        });
      }
      return room;
    },
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    }
  });

  const archive = useMutation({
    mutationFn: (roomId: string) => api.roomApi.archive(roomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] })
  });

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setLayoutFile(null);
  }

  function edit(room: RoomDto) {
    setEditingId(room.id);
    setForm({
      name: room.name,
      capacity: String(room.capacity),
      status: room.status,
      layoutUrl: room.layoutUrl ?? ""
    });
    setLayoutFile(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <section>
      <div className="section-header">
        <h1>Rooms</h1>
      </div>
      <section className="panel">
        <h2>{editingId ? "Edit room" : "New room"}</h2>
        <form className="form-grid" onSubmit={submit}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min="1"
              value={form.capacity}
              onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as RoomStatus }))}>
              {Object.values(RoomStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Layout URL
            <input value={form.layoutUrl} onChange={(event) => setForm((current) => ({ ...current, layoutUrl: event.target.value }))} />
          </label>
          <label className="full">
            Layout upload
            <input type="file" accept="image/*,application/pdf" onChange={(event) => setLayoutFile(event.target.files?.[0] ?? null)} />
          </label>
          {save.error ? <p className="error full">{save.error.message}</p> : null}
          <div className="toolbar full">
            <button type="submit" disabled={save.isPending}>
              <Save size={18} /> Save
            </button>
            {editingId ? (
              <button className="secondary" type="button" onClick={resetForm}>
                <X size={18} /> Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>
      {rooms.isLoading ? <p>Loading...</p> : null}
      {rooms.error ? <p className="error">{rooms.error.message}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Layout</th>
              <th>Workshops</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rooms.data?.map((room) => (
              <tr key={room.id}>
                <td>{room.name}</td>
                <td>{room.capacity}</td>
                <td>{room.status}</td>
                <td>{room.layoutUrl ? <a href={room.layoutUrl}>View</a> : ""}</td>
                <td>{room.workshopCount ?? 0}</td>
                <td className="actions">
                  <button className="icon-button secondary" onClick={() => edit(room)} title="Edit">
                    <Edit size={16} />
                  </button>
                  <button
                    className="icon-button secondary"
                    onClick={() => {
                      if (window.confirm(`Archive ${room.name}?`)) {
                        archive.mutate(room.id);
                      }
                    }}
                    title="Archive"
                  >
                    <Archive size={16} />
                  </button>
                  <label className="icon-button secondary upload-action" title="Upload layout">
                    <FileUp size={16} />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void api.roomApi
                            .uploadLayout(room.id, { fileName: file.name, contentType: file.type || "image/png", size: file.size })
                            .then(() => queryClient.invalidateQueries({ queryKey: ["rooms"] }));
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
