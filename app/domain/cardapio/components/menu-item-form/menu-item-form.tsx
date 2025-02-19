import { Category } from "@prisma/client"
import { Form } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import formatStringList from "~/utils/format-string-list"
import { cn } from "~/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { Label } from "~/components/ui/label"
import { ChangeEvent, useRef, useState } from "react"
import Fieldset from "~/components/ui/fieldset"
import { Textarea } from "~/components/ui/textarea"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import useSaveShortcut from "~/hooks/use-save-shortcut.hook"
import { Button } from "~/components/ui/button"
import { CloudinaryImageInfo, CloudinaryUploadWidget, CloudinaryUtils } from "~/lib/cloudinary"
import { jsonStringify } from "~/utils/json-helper"


export type MenuItemFormAction = "menu-item-create" | "menu-item-update"

interface MenuItemFormProps {
    item?: MenuItemWithAssociations
    categories?: Category[]
    action: MenuItemFormAction
    className?: string
}

export default function MenuItemForm({ item, action, className, categories }: MenuItemFormProps) {
    const [currentBasePrice, setCurrentBasePrice] = useState(item?.basePriceAmount || 0)

    const submitButtonRef = useRef<any>()
    useSaveShortcut({ callback: submitForm })

    function submitForm() {
        if (!submitButtonRef.current) return
        submitButtonRef.current.click()
    }


    return (

        <div className="flex flex-col">

            <Form method="post" className={cn(className)}  >

                <input type="hidden" name="id" value={item?.id} />

                <section className="grid grid-cols-12 gap-x-4 items-center w-full">
                    <div className="flex items-center  gap-2 col-span-5">
                        <Input type="text" name="name" defaultValue={item?.name}
                            placeholder="Nome da pizza"
                            className="font-semibold tracking-tight" />
                    </div>
                    {/* <div className="grid grid-cols-4 col-span-4">
                        {item && item.priceVariations.map(pv => {
                            return (
                                <div key={pv.id} className="flex flex-col justify-center">
                                    <span className="text-xs text-muted-foreground">{mapPriceVariationsLabel(pv.label)}</span>
                                    <span className="text-sm font-semibold">{pv.amount.toFixed(2)}</span>
                                </div>
                            )

                        })}
                    </div> */}

                    <div className="flex justify-between md:justify-end gap-4 w-full items-center mt-2 col-span-7">
                        <span className="font-semibold text-sm">Públicar no cardápio</span>
                        <Switch id="visible" name="visible" defaultChecked={item?.visible || false} />
                    </div>


                </section>


                <Separator className="my-8" />

                <section className="grid grid-cols-8 justify-between gap-x-2">
                    <div className="flex flex-col col-span-4">
                        <input type="hidden" name="id" value={item?.id || ""} />

                        <Fieldset>
                            <Textarea name="ingredients"
                                placeholder="Ingredientes"
                                defaultValue={formatStringList(item?.ingredients, { firstLetterCapitalized: true })}
                                className={cn(
                                    "text-xs md:text-sm col-span-4",
                                    action === "menu-item-create" && "border",
                                    // action === "menu-item-update" && "border-none focus:px-2 p-0"
                                )} />
                        </Fieldset>

                        <Fieldset className="grid grid-cols-4 items-center" >
                            <div className="flex flex-col gap-0">
                                <Label className="font-semibold text-sm col-span-1">Preço Base</Label>
                                <span className="text-xs text-muted-foreground">(Tamanho Medio)</span>
                            </div>
                            <Input type="text" name="basePriceAmount"
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (isNaN(Number(value))) return

                                    setCurrentBasePrice(Number(value))
                                }}
                                defaultValue={item?.basePriceAmount || "0"}
                                className={
                                    cn(
                                        "text-xs md:text-sm col-span-1",
                                        action === "menu-item-create" && "border",
                                        action === "menu-item-update" && "p-0 border-none focus:px-2"
                                    )
                                } />
                        </Fieldset>

                    </div>

                    <Select name="category" defaultValue={JSON.stringify(item?.Category)} >
                        <SelectTrigger className="text-xs col-span-2 uppercase tracking-wide" >
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent id="category" >
                            <SelectGroup >
                                {categories && categories.map(category => {
                                    return (
                                        <SelectItem key={category.id} value={JSON.stringify(category)} className="text-lg">{category.name}</SelectItem>
                                    )
                                })}
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                </section>

                <Separator className="mb-4" />


                <div className="flex flex-col gap-2">
                    <Label htmlFor="imageFile" className="font-semibold text-sm " >Imagem</Label>
                    <div className="grid grid-cols-8 items-center gap-x-4 w-full   ">
                        <div className="col-span-2 flex gap-4 items-center">
                            <ImageUploader imageInfo={item?.MenuItemImage} />
                        </div>
                        <div className="col-span-6">
                            <div className="border p-4 rounded-lg ">
                                <div className="flex flex-col justify-center gap-2">
                                    <div className="w-24 h-24 bg-muted rounded-lg bg-center bg-no-repeat bg-cover"
                                        style={{ backgroundImage: `url(${item?.MenuItemImage?.thumbnailUrl || ""})` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <section className="flex flex-col">


                    <Fieldset className="grid grid-cols-4 items-center">
                        <Label htmlFor="mogoId" className="font-semibold text-sm col-span-1">Mogo ID</Label>
                        <Input type="text" id="mogoId" name="mogoId"
                            placeholder="ID produto mogo"
                            defaultValue={item?.mogoId}
                            className={cn(
                                "text-xs md:text-sm col-span-3",
                                action === "menu-item-create" && "border",
                                action === "menu-item-update" && "border-none focus:px-2 p-0"
                            )} />
                    </Fieldset>


                </section>

                <Separator className="my-4" />

                <Fieldset className="grid grid-cols-4 items-center">
                    <Label htmlFor="notesPublic" className="font-semibold text-sm col-span-1">Observações publicas</Label>
                    <Textarea id="notesPublic" name="notesPublic"
                        placeholder="Adicione observações publicas..."
                        defaultValue={item?.notesPublic || ""}
                        className={cn(
                            "text-xs md:text-sm col-span-3",
                            action === "menu-item-create" && "border",
                            action === "menu-item-update" && "border-none focus:px-2"
                        )}
                    />
                </Fieldset>

                <Separator className="my-4" />

                <div className="flex gap-4 justify-end">

                    <SubmitButton ref={submitButtonRef} actionName={action} labelClassName="text-xs" variant={"outline"} tabIndex={0} iconColor="black" />
                    {action === "menu-item-update" && (
                        <DeleteItemButton actionName="menu-item-delete" label="Deletar" />
                    )}
                </div>
            </Form>
        </div>

    )
}

interface ImageUploaderProps {
    imageInfo: MenuItemWithAssociations["MenuItemImage"] | undefined
}


export function ImageUploader({ imageInfo }: ImageUploaderProps) {
    const [info, updateInfo] = useState<MenuItemWithAssociations["MenuItemImage"] | undefined>(imageInfo);
    const [error, updateError] = useState();

    // @ts-ignore
    function handleOnUpload(error, result, widget) {
        if (error) {
            updateError(error);
            widget.close({
                quiet: true,
            });
            return;
        }

        const info = result?.info

        updateInfo({
            id: info?.id ?? null,
            secureUrl: info.secure_url,
            assetFolder: info.asset_folder,
            originalFileName: info.original_filename,
            displayName: info.display_name,
            height: info.height,
            width: info.width,
            thumbnailUrl: info.thumbnail_url,
            format: info.format,
            publicId: info.public_id
        });

    }

    return (
        <>
            <input type="hidden" id="imageInfo" name="imageInfo" defaultValue={jsonStringify(info ?? imageInfo)} />

            <CloudinaryUploadWidget presetName="admin-cardapio" onUpload={handleOnUpload}>

                {
                    // @ts-ignore
                    ({ open }) => {
                        return <Button onClick={open}>Upload Image</Button>;
                    }
                }
            </CloudinaryUploadWidget>
        </>
    )
}




