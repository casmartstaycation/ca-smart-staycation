const API =
"https://ca-smart-staycation-muqd.onrender.com/api";

loadBookings();

async function loadBookings(){

const res = await fetch(`${API}/bookings`);

const json = await res.json();

const bookings = json.data;

const tbody =
document.querySelector("#bookingTable tbody");

tbody.innerHTML="";

bookings.forEach(booking=>{

let proof="No Upload";

if(booking.paymentProof){

proof=`
<a
target="_blank"
href="https://ca-smart-staycation-muqd.onrender.com/uploads/payments/${booking.paymentProof}">
View Proof
</a>
`;

}

let action="";

if(
booking.bookingStatus==="Pending Payment Verification"
){

action=`
<button
class="approve"
onclick="approvePayment('${booking._id}')">
Approve
</button>
`;

}

tbody.innerHTML+=`

<tr>

<td>${booking.bookingReference}</td>

<td>
${booking.firstName}
${booking.lastName}
</td>

<td>
${
booking.room
?
`${booking.room.unitNumber}<br>${booking.room.unitName}`
:
"-"
}
</td>

<td>
${
booking.parking
?
`${booking.parking.parkingNumber}`
:
"-"
}
</td>

<td>₱${booking.totalAmount}</td>

<td>${booking.paymentStatus}</td>

<td>${booking.bookingStatus}</td>

<td>${proof}</td>

<td>${action}</td>

</tr>

`;

});

}

async function approvePayment(id){

const res=
await fetch(

`${API}/bookings/${id}/approve-payment`,

{

method:"PUT"

}

);

const json=await res.json();

alert(json.message);

loadBookings();

}