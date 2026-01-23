function calculateOfferPrice(arv, repairs) {
  repairs = repairs || Math.round(arv * 0.10);
  var arv70 = Math.round(arv * 0.70);
  var offer = arv70 - repairs;
  return { arv: arv, arv70: arv70, repairs: repairs, offer: Math.max(0, offer) };
}

var lead = { arv: 250000, repairs: 25000, excess: 47500 };
var calc = calculateOfferPrice(lead.arv, lead.repairs);
var buyboxMin = Math.round(calc.offer * 1.15);
var buyboxMax = Math.round(calc.offer * 1.25);
var recoveryFee = Math.round(lead.excess * 0.25);

console.log('\nMaxSam V4 - Offer Calculator\n');
console.log('ARV:            $' + calc.arv.toLocaleString());
console.log('ARV x 70%:      $' + calc.arv70.toLocaleString());
console.log('Less Repairs:  -$' + calc.repairs.toLocaleString());
console.log('------------------------');
console.log('OFFER PRICE:    $' + calc.offer.toLocaleString());
console.log('\nBuyBox Range:   $' + buyboxMin.toLocaleString() + ' - $' + buyboxMax.toLocaleString());
console.log('Your Spread:    $' + (buyboxMin - calc.offer).toLocaleString() + ' - $' + (buyboxMax - calc.offer).toLocaleString());
console.log('Recovery Fee:   $' + recoveryFee.toLocaleString());
console.log('TOTAL MAX:      $' + (buyboxMax - calc.offer + recoveryFee).toLocaleString() + '\n')