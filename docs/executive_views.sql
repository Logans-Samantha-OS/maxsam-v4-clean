-- Executive Analytics Views
-- Source of truth for dashboards and read-only AI analysis

-- 1. KPI Snapshot
create or replace view v_exec_kpi_snapshot as
select
  count(*) as total_events,
  sum(total_revenue) as total_revenue,
  sum(total_cost) as total_cost,
  sum(total_profit) as total_profit,
  avg(avg_profit_per_event) as avg_profit_per_event,
  count(*) filter (where total_profit > 0) as winning_events,
  count(*) filter (where total_profit <= 0) as losing_events
from v_outcome_ledger;

-- 2. Outcome Performance Summary
create or replace view v_exec_outcome_performance as
select
  outcome_type,
  count(*) as occurrences,
  sum(total_revenue) as total_revenue,
  sum(total_cost) as total_cost,
  sum(total_profit) as total_profit,
  avg(avg_profit_per_event) as avg_profit_per_event
from v_outcome_ledger
group by outcome_type
order by total_profit desc;

-- 3. Profit Time Series
create or replace view v_exec_profit_timeseries as
select
  outcome_type,
  sum(total_profit) as total_profit,
  avg(avg_profit_per_event) as avg_profit
from v_outcome_ledger
group by outcome_type;

-- 4. Agent Attribution
create or replace view v_exec_agent_attribution as
select
  agent_name,
  count(*) as events,
  sum(total_profit) as total_profit,
  avg(avg_profit_per_event) as avg_profit
from v_task_outcome_attribution
group by agent_name
order by total_profit desc;

-- 5. Loss Analysis
create or replace view v_exec_loss_analysis as
select
  outcome_type,
  count(*) as loss_events,
  sum(total_cost) as total_cost,
  sum(total_profit) as total_profit
from v_outcome_ledger
where total_profit < 0
group by outcome_type
order by total_cost desc;
