import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkshopDto, WorkshopSeatAvailabilityDto } from "@unihub/shared-types";
import { api } from "../../lib/api";

function toSeatPayload(workshop: WorkshopDto): WorkshopSeatAvailabilityDto {
  return {
    workshopId: workshop.id,
    capacity: workshop.capacity,
    registeredCount: workshop.registeredCount,
    remainingSeats: workshop.remainingSeats,
    status: workshop.status,
    updatedAt: workshop.endTime
  };
}

function applySeatPayload(workshop: WorkshopDto, payload: WorkshopSeatAvailabilityDto): WorkshopDto {
  return {
    ...workshop,
    capacity: payload.capacity,
    registeredCount: payload.registeredCount,
    remainingSeats: payload.remainingSeats,
    status: payload.status
  };
}

export function useWorkshopSeatAvailability(workshop: WorkshopDto) {
  const queryClient = useQueryClient();
  const [seat, setSeat] = useState<WorkshopSeatAvailabilityDto>(() => toSeatPayload(workshop));
  const [streamFailed, setStreamFailed] = useState(false);

  useEffect(() => {
    setSeat(toSeatPayload(workshop));
  }, [workshop]);

  useEffect(() => {
    setStreamFailed(false);
    const stop = api.workshopApi.streamSeats(workshop.id, {
      onEvent: (payload) => {
        setSeat(payload);
        queryClient.setQueryData<WorkshopDto>(["workshop", workshop.id], (current) =>
          current ? applySeatPayload(current, payload) : current
        );
        queryClient.setQueriesData<WorkshopDto[]>({ queryKey: ["workshops"] }, (current) =>
          current?.map((item) => (item.id === workshop.id ? applySeatPayload(item, payload) : item))
        );
      },
      onError: () => setStreamFailed(true)
    });

    return stop;
  }, [queryClient, workshop.id]);

  useEffect(() => {
    if (!streamFailed) {
      return undefined;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const payload = await api.workshopApi.seats(workshop.id);
        if (!cancelled) {
          setSeat(payload);
        }
      } catch {
        // Keep the existing seat state; the next interval can recover.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 7_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [streamFailed, workshop.id]);

  return seat;
}
