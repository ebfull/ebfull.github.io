initSidebarItems({"struct":[["Accept","Accept either `P` or something in `Q`."],["Choose","Choose from `P` or something in `Q`."],["End","The session is at the end of communication. The channel can now be gracefully closed."],["Escape","Escape from a nested scope by an arbitrary number of layers `N`, using peano numbers."],["Finally","Finally choose `P`."],["Nest","Protocols ocassionally do not follow a linear path of behavior. It may be necessary to return to a previous \"state\" in the protocol. However, this cannot be expressed in the typesystem, because the type will fold over itself infinitely. Instead, `Nest<S>` and `Escape<N>` are provided. These types allow you to \"break\" out of a nested scope in the protocol by an arbitrary number of layers `N`."],["Recv","The session expects to receive `T` and proceed to session `S`."],["Send","The session expects to send `T` and proceed to session `S`."]],"trait":[["Acceptor","This trait effectively posits that a protocol which handles `T` must additionally handle other types. If `T` is an `Accept<P, Q>` the protocol must handle `P` *and* be an `Acceptor` of `Q`. If `T` is  a `Finally<P>` it must handle `P`."],["Chooser","This trait selects for the de-Bruijn index of a protocol embedded within a `Choose` decision tree."],["SessionType","All session types have duality. Two clients that communicate will always have a session type that is the dual of their counterpart."]]});