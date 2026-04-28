import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { z } from "zod";
import { WorkshopStatus } from "@unihub/shared-types";
import { api } from "../../lib/api";

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string().min(2),
  roomId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  priceAmount: z.coerce.number().min(0),
  status: z.nativeEnum(WorkshopStatus)
});

type FormValues = z.infer<typeof schema>;

export function AdminWorkshopFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api.raw.request<Array<{ id: string; name: string }>>("/rooms") });
  const detail = useQuery({ queryKey: ["workshop", id], queryFn: () => api.workshopApi.detail(id!), enabled: Boolean(id) });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: "Career",
      roomId: "",
      startTime: "2026-05-15T09:00",
      endTime: "2026-05-15T11:00",
      capacity: 40,
      priceAmount: 0,
      status: WorkshopStatus.PUBLISHED
    }
  });

  useEffect(() => {
    if (detail.data) {
      form.reset({
        title: detail.data.title,
        description: detail.data.description,
        category: detail.data.category,
        roomId: detail.data.room.id,
        startTime: detail.data.startTime.slice(0, 16),
        endTime: detail.data.endTime.slice(0, 16),
        capacity: detail.data.capacity,
        priceAmount: detail.data.priceAmount,
        status: detail.data.status
      });
    }
  }, [detail.data, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString()
      };
      return id ? api.workshopApi.update(id, payload) : api.workshopApi.create(payload);
    },
    onSuccess: () => navigate("/admin/workshops")
  });

  return (
    <section className="panel">
      <h1>{id ? "Edit workshop" : "New workshop"}</h1>
      <form className="form-grid" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <label>
          Title
          <input {...form.register("title")} />
        </label>
        <label>
          Category
          <input {...form.register("category")} />
        </label>
        <label className="full">
          Description
          <textarea rows={4} {...form.register("description")} />
        </label>
        <label>
          Room
          <select {...form.register("roomId")}>
            <option value="">Select room</option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Capacity
          <input type="number" {...form.register("capacity")} />
        </label>
        <label>
          Start
          <input type="datetime-local" {...form.register("startTime")} />
        </label>
        <label>
          End
          <input type="datetime-local" {...form.register("endTime")} />
        </label>
        <label>
          Price
          <input type="number" {...form.register("priceAmount")} />
        </label>
        <label>
          Status
          <select {...form.register("status")}>
            {Object.values(WorkshopStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        {save.error ? <p className="error full">{save.error.message}</p> : null}
        <button className="full" type="submit">
          <Save size={18} /> Save
        </button>
      </form>
    </section>
  );
}
