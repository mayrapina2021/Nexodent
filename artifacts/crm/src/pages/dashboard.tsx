import Layout from "@/components/layout";
import { useGetDashboardStats, useGetTodayAppointments, useGetRecentActivity, useGetMonthlyChart } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Users, CalendarCheck, MessageSquare, CheckCircle, UserPlus, MessageCircle, Activity, DollarSign, AlertTriangle, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const statCards = [
  { key: "totalPatients", label: "Total Pacientes", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
  { key: "appointmentsToday", label: "Citas Hoy", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100" },
  { key: "pendingMessages", label: "Mensajes Pendientes", icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-100" },
  { key: "confirmedAppointments", label: "Citas Confirmadas", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
  { key: "newPatientsThisMonth", label: "Nuevos Este Mes", icon: UserPlus, color: "text-purple-600", bg: "bg-purple-100" },
  { key: "activeConversations", label: "Conversaciones Activas", icon: MessageCircle, color: "text-cyan-600", bg: "bg-cyan-100" },
];

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

const statusLabels: Record<string, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

function to12h(time24: string): string {
  if (!time24) return time24;
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "p.m." : "a.m.";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(val);
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: todayAppts, isLoading: apptsLoading } = useGetTodayAppointments();
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: chartData, isLoading: chartLoading } = useGetMonthlyChart();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <img src="/logo.png" alt="Nexodent" className="h-16 md:h-24 w-auto object-contain" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Panel de Control</p>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
            >
              <Card className="border-border/50 bg-card/80 hover:bg-card transition-colors">
                <CardContent className="p-4">
                  <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {(stats as any)?.[card.key] ?? 0}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Finanzas avanzadas */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100"><DollarSign className="w-5 h-5 text-emerald-700" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos reales del mes</p>
                  <p className="text-xl font-bold">{formatCurrency((stats as { actualMonthlyRevenue?: number }).actualMonthlyRevenue ?? 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100"><AlertTriangle className="w-5 h-5 text-amber-700" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Cuotas vencidas</p>
                  <p className="text-xl font-bold">{(stats as { overdueInstallments?: number }).overdueInstallments ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-violet-200 bg-violet-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100"><Stethoscope className="w-5 h-5 text-violet-700" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Tratamientos activos</p>
                  <p className="text-xl font-bold">{(stats as { activeTreatments?: number }).activeTreatments ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Gráficas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="border-border/50 bg-card/80 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-accent" />
                  Citas y Nuevos Pacientes (últimos 6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Array.isArray(chartData) ? chartData : []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="appointments" fill="hsl(217 60% 45%)" radius={[4,4,0,0]} name="Citas" />
                      <Bar dataKey="newPatients" fill="hsl(102 54% 53%)" radius={[4,4,0,0]} name="Nuevos" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-border/50 bg-card/80 h-full">
              <CardHeader>
                <CardTitle className="text-base">Ingresos Estimados</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-10 w-32" /> : (
                  <>
                    <p className="text-3xl font-bold text-accent">
                      {formatCurrency(stats?.estimatedMonthlyRevenue ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Este mes</p>
                  </>
                )}
                {chartLoading ? <Skeleton className="h-32 w-full mt-4" /> : (
                  <ResponsiveContainer width="100%" height={120} className="mt-4">
                    <LineChart data={Array.isArray(chartData) ? chartData : []}>
                      <Line type="monotone" dataKey="revenue" stroke="hsl(102 54% 53%)" strokeWidth={2} dot={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        formatter={(v: number) => [formatCurrency(v), "Ingresos"]}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Citas de hoy y actividad reciente */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Citas de Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              {apptsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !Array.isArray(todayAppts) || !todayAppts.length ? (
                <p className="text-muted-foreground text-sm text-center py-6">No hay citas programadas para hoy</p>
              ) : (
                <div className="space-y-3">
                  {todayAppts.map(appt => (
                    <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                      <div>
                        <p className="text-sm font-medium text-foreground">{appt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{appt.treatment} · {to12h(appt.startTime)} - {to12h(appt.endTime)}</p>
                      </div>
                      <Badge className={`text-xs ${statusColors[appt.status] ?? "bg-muted text-muted-foreground"}`}>
                        {statusLabels[appt.status] ?? appt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !Array.isArray(recentActivity) || !recentActivity.length ? (
                <p className="text-muted-foreground text-sm text-center py-6">Sin actividad reciente</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.slice(0, 8).map(item => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-foreground">{item.description}</p>
                        {item.patientName && <p className="text-xs text-muted-foreground">{item.patientName}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
