import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { api } from "../../lib/api";

export function WorkshopListPage() {
  const query = useQuery({ queryKey: ["workshops"], queryFn: () => api.workshopApi.list() });

  return (
    <section>
      <div className="section-header">
        <h1>Workshops</h1>
      </div>
      {query.isLoading ? <p>Loading...</p> : null}
      {query.error ? <p className="error">{query.error.message}</p> : null}
      <div className="grid">
        {query.data?.map((workshop) => (
          <Link to={`/workshops/${workshop.id}`} className="workshop-card" key={workshop.id}>
            <span className={workshop.priceAmount > 0 ? "badge paid" : "badge free"}>
              {workshop.priceAmount > 0 ? `${workshop.priceAmount.toLocaleString("vi-VN")} ${workshop.currency}` : "Free"}
            </span>
            <h2>{workshop.title}</h2>
            <p>{workshop.description}</p>
            <div className="meta">
              <span>
                <CalendarDays size={16} /> {new Date(workshop.startTime).toLocaleString("vi-VN")}
              </span>
              <span>
                <MapPin size={16} /> {workshop.room.name}
              </span>
            </div>
            <progress value={workshop.registeredCount} max={workshop.capacity} />
            <small>{workshop.remainingSeats} chỗ còn lại</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
