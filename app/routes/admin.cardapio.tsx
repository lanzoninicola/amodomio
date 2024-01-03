import { Outlet } from "@remix-run/react";



export default function AdminCardapioOutlet() {
    return (
        <>
            <div>
                <h1>Admin Cardápio</h1>
            </div>
            <Outlet></Outlet>
        </>

    )

}