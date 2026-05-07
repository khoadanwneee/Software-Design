import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Search, X } from "lucide-react";
import { Role, UserStatus, type AdminUserDto, type UserListFilters } from "@unihub/shared-types";
import { api } from "../../lib/api";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const debouncedKeyword = useDebouncedValue(keyword, 400);

  useEffect(() => {
    setKeyword(searchParams.get("keyword") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("keyword") ?? "";
    if (debouncedKeyword === current) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (debouncedKeyword.trim()) {
      next.set("keyword", debouncedKeyword.trim());
    } else {
      next.delete("keyword");
    }
    setSearchParams(next, { replace: true });
  }, [debouncedKeyword, searchParams, setSearchParams]);

  const filters = useMemo<UserListFilters>(
    () => ({
      keyword: searchParams.get("keyword") ?? undefined,
      role: (searchParams.get("role") as Role | null) ?? undefined,
      status: (searchParams.get("status") as UserStatus | null) ?? undefined,
      limit: 100
    }),
    [searchParams]
  );

  const users = useQuery({ queryKey: ["users", filters], queryFn: () => api.userApi.list(filters) });

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setKeyword("");
    setSearchParams({}, { replace: true });
  }

  return (
    <section>
      <div className="section-header">
        <h1>Users</h1>
        <button className="secondary" onClick={clearFilters}>
          <X size={18} /> Clear filters
        </button>
      </div>
      <div className="panel filters-panel">
        <label className="full">
          Search
          <span className="input-with-icon">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search name or email" />
          </span>
        </label>
        <label>
          Role
          <select value={searchParams.get("role") ?? ""} onChange={(event) => updateParam("role", event.target.value)}>
            <option value="">All roles</option>
            {Object.values(Role).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={searchParams.get("status") ?? ""} onChange={(event) => updateParam("status", event.target.value)}>
            <option value="">All statuses</option>
            {Object.values(UserStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      {users.isLoading ? <p>Loading...</p> : null}
      {users.error ? <p className="error">{users.error.message}</p> : null}
      {!users.isLoading && users.data?.length === 0 ? <p className="notice">No users match the current filters.</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>{users.data?.map((user) => <UserRow key={user.id} user={user} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function sameRoles(left: Role[], right: Role[]) {
  return [...left].sort().join(",") === [...right].sort().join(",");
}

function UserRow({ user }: { user: AdminUserDto }) {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [status, setStatus] = useState<UserStatus>(user.status);

  useEffect(() => {
    setRoles(user.roles);
    setStatus(user.status);
  }, [user]);

  const saveRoles = useMutation({
    mutationFn: () => api.userApi.updateRoles(user.id, { roles }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });

  const saveStatus = useMutation({
    mutationFn: () => api.userApi.updateStatus(user.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });

  function toggleRole(role: Role) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  function submitRoles() {
    if (roles.length === 0) {
      return;
    }
    if (user.roles.includes(Role.ADMIN) !== roles.includes(Role.ADMIN) && !window.confirm(`Change ADMIN role for ${user.email}?`)) {
      return;
    }
    saveRoles.mutate();
  }

  return (
    <tr>
      <td>{user.fullName}</td>
      <td>{user.email}</td>
      <td>
        <div className="checkbox-grid">
          {Object.values(Role).map((role) => (
            <label className="checkbox-row" key={role}>
              <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
              {role}
            </label>
          ))}
        </div>
        {saveRoles.error ? <p className="error inline-error">{saveRoles.error.message}</p> : null}
      </td>
      <td>
        <select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)}>
          {Object.values(UserStatus).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {saveStatus.error ? <p className="error inline-error">{saveStatus.error.message}</p> : null}
      </td>
      <td>{new Date(user.createdAt).toLocaleString("vi-VN")}</td>
      <td className="actions">
        <button className="icon-button secondary" disabled={sameRoles(user.roles, roles) || saveRoles.isPending} onClick={submitRoles} title="Save roles">
          <Save size={16} />
        </button>
        <button
          className="icon-button secondary"
          disabled={user.status === status || saveStatus.isPending}
          onClick={() => saveStatus.mutate()}
          title="Save status"
        >
          <Save size={16} />
        </button>
      </td>
    </tr>
  );
}
