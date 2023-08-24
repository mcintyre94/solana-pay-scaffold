from seahorse.prelude import *

# This is your program's public key and it will update
# automatically when you build the project.
declare_id('GJk5YqJDMgTT8CFWfDZLFVnw8GXJucyTnqBcFcf2Dxcf')


class Order(Account):
    buyer: Pubkey
    pepperoni: i8
    cheese: i8
    mushrooms: i8


@instruction
def init(payer: Signer, order: Empty[Order], buyer: Pubkey, pepperoni: i8, cheese: i8, mushrooms: i8):
    order = order.init(payer=payer)
    order.buyer = buyer
    order.pepperoni = pepperoni
    order.cheese = cheese
    order.mushrooms = mushrooms
