import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, 
  AreaChart, Area, ComposedChart 
} from 'recharts';
import { 
  Clock, AlertTriangle, CheckCircle2, Users, ArrowUp, ArrowDown,
  Calendar, Filter, Download, Clock8
} from 'lucide-react';
import type { Ticket } from '../types/ticket';

interface DashboardProps {
  tickets: Ticket[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export function Dashboard({ tickets }: DashboardProps) {
  // Estado para filtros
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Aplicar filtros
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];
    
    // Filtro por data
    const now = new Date();
    let cutoffDate: Date;
    
    if (dateRange === '7d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    
    filtered = filtered.filter(t => new Date(t.createdAt) >= cutoffDate);
    
    // Filtro por categoria
    if (categoryFilter) {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    
    return filtered;
  }, [tickets, dateRange, categoryFilter]);

  // Métricas
  const totalTickets = filteredTickets.length;
  const openTickets = filteredTickets.filter(t => t.status === 'open').length;
  const inProgressTickets = filteredTickets.filter(t => t.status === 'in_progress').length;
  const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved').length;
  const closedTickets = filteredTickets.filter(t => t.status === 'closed').length;
  
  const avgResolutionTime = resolvedTickets > 0 
    ? filteredTickets
        .filter(t => t.status === 'resolved')
        .reduce((acc, t) => {
          const diff = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
          return acc + diff;
        }, 0) / resolvedTickets
    : 0;

  // Taxa de resolução dentro do prazo
  const resolvedInDeadline = filteredTickets
    .filter(t => t.status === 'resolved')
    .filter(t => new Date(t.updatedAt) <= new Date(t.deadline))
    .length;
    
  const deadlineComplianceRate = resolvedTickets > 0 
    ? (resolvedInDeadline / resolvedTickets) * 100 
    : 0;

  // Calcular variação em relação ao período anterior
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentTickets = tickets.filter(t => new Date(t.createdAt) >= sevenDaysAgo).length;
  const previousTickets = tickets.filter(t => 
    new Date(t.createdAt) >= fourteenDaysAgo && 
    new Date(t.createdAt) < sevenDaysAgo
  ).length;

  const ticketVariation = previousTickets ? 
    ((recentTickets - previousTickets) / previousTickets) * 100 : 
    0;

  // Dados para gráficos
  const statusData = [
    { name: 'Abertos', value: openTickets },
    { name: 'Em Progresso', value: inProgressTickets },
    { name: 'Resolvidos', value: resolvedTickets },
    { name: 'Fechados', value: closedTickets }
  ];

  const categoryData = [
    { name: 'Software', count: filteredTickets.filter(t => t.category === 'software').length },
    { name: 'Hardware', count: filteredTickets.filter(t => t.category === 'hardware').length },
    { name: 'Rede', count: filteredTickets.filter(t => t.category === 'network').length },
    { name: 'Outros', count: filteredTickets.filter(t => t.category === 'other').length }
  ];

  // Dados para gráfico de tendências (últimos 30 dias)
  const trendData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayTickets = tickets.filter(t => {
        const createdAt = new Date(t.createdAt);
        return createdAt >= dayStart && createdAt <= dayEnd;
      });
      
      data.push({
        date: `${dayStart.getDate()}/${dayStart.getMonth() + 1}`,
        total: dayTickets.length,
        resolved: dayTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
      });
    }
    
    return data;
  }, [tickets, dateRange]);

  // Dados para análise de tempo médio por categoria
  const resolutionTimeByCategory = useMemo(() => {
    const categories = ['software', 'hardware', 'network', 'other'];
    return categories.map(category => {
      const categoryTickets = filteredTickets.filter(t => 
        t.category === category && 
        (t.status === 'resolved' || t.status === 'closed')
      );
      
      const avgTime = categoryTickets.length > 0
        ? categoryTickets.reduce((acc, t) => {
            const diff = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
            return acc + diff;
          }, 0) / categoryTickets.length / (1000 * 60 * 60) // em horas
        : 0;
        
      return {
        name: category === 'software' ? 'Software' : 
              category === 'hardware' ? 'Hardware' : 
              category === 'network' ? 'Rede' : 'Outros',
        avgTime: Math.round(avgTime)
      };
    });
  }, [filteredTickets]);

  // Verificar tickets próximos do prazo
  const nearDeadlineTickets = filteredTickets.filter(t => {
    if (t.status === 'resolved' || t.status === 'closed') return false;
    
    const deadline = new Date(t.deadline);
    const now = new Date();
    const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return diffHours > 0 && diffHours < 24; // Menos de 24h para o prazo
  }).length;

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setDateRange('7d')}
              className={`px-3 py-1 text-sm rounded-full ${
                dateRange === '7d' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              7 dias
            </button>
            <button 
              onClick={() => setDateRange('30d')}
              className={`px-3 py-1 text-sm rounded-full ${
                dateRange === '30d' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              30 dias
            </button>
            <button 
              onClick={() => setDateRange('90d')}
              className={`px-3 py-1 text-sm rounded-full ${
                dateRange === '90d' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              90 dias
            </button>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setCategoryFilter(null)}
              className={`px-3 py-1 text-sm rounded-full ${
                categoryFilter === null 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas categorias
            </button>
            <button 
              onClick={() => setCategoryFilter('software')}
              className={`px-3 py-1 text-sm rounded-full ${
                categoryFilter === 'software' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Software
            </button>
            <button 
              onClick={() => setCategoryFilter('hardware')}
              className={`px-3 py-1 text-sm rounded-full ${
                categoryFilter === 'hardware' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hardware
            </button>
            <button 
              onClick={() => setCategoryFilter('network')}
              className={`px-3 py-1 text-sm rounded-full ${
                categoryFilter === 'network' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rede
            </button>
          </div>
          
          <div className="ml-auto">
            <button className="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700">
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total de Tickets</p>
              <div className="flex items-center mt-2">
                <p className="text-2xl font-bold text-gray-900">{totalTickets}</p>
                <span className={`ml-2 text-sm font-medium flex items-center ${
                  ticketVariation >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {ticketVariation >= 0 ? (
                    <ArrowUp className="h-4 w-4 mr-1" />
                  ) : (
                    <ArrowDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(ticketVariation).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            vs período anterior
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tickets Abertos</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{openTickets}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-400 h-2 rounded-full" 
                style={{ width: `${(openTickets / (totalTickets || 1)) * 100}%` }}
              />
            </div>
            <span className="ml-2 text-gray-500">
              {((openTickets / (totalTickets || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Resolvidos</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{resolvedTickets}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-400 h-2 rounded-full" 
                style={{ width: `${(resolvedTickets / (totalTickets || 1)) * 100}%` }}
              />
            </div>
            <span className="ml-2 text-gray-500">
              {((resolvedTickets / (totalTickets || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tempo Médio Resolução</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {Math.round(avgResolutionTime / (1000 * 60 * 60))}h
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Média dos tickets resolvidos
          </p>
        </div>
      </div>

      {/* Nova linha de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Taxa de Cumprimento de Prazo</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {deadlineComplianceRate.toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Tickets resolvidos dentro do prazo
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tickets Por Resolver</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {openTickets + inProgressTickets}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock8 className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-400 h-2 rounded-full" 
                style={{ width: `${((openTickets + inProgressTickets) / (totalTickets || 1)) * 100}%` }}
              />
            </div>
            <span className="ml-2 text-gray-500">
              {(((openTickets + inProgressTickets) / (totalTickets || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Próximos do Prazo</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {nearDeadlineTickets}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Tickets com menos de 24h de prazo
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Status dos Tickets</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Tickets por Categoria</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráficos Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Tendência de Tickets</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="total" name="Total" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                <Area type="monotone" dataKey="resolved" name="Resolvidos" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Tempo Médio por Categoria (horas)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resolutionTimeByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgTime" name="Tempo Médio (h)" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}