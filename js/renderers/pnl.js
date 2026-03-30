import { S } from '../state.js';
import { setVal } from '../utils.js';

export function renderPnl() {
  setVal('p-spread', '$' + S.spreadRevenue.toLocaleString());
  setVal('p-comm',   '$' + S.commRevenue.toLocaleString());
  setVal('p-swap',   '$' + S.swapRevenue.toLocaleString());
  setVal('p-bbook',  '$' + S.bBookPnl.toLocaleString());
  setVal('p-gross',  '$' + S.grossRevenue.toLocaleString());
  setVal('p-net',    '$' + S.netProfit.toLocaleString());
}
