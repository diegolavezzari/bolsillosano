// ===== JS de tribunal.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)
//
// Tablas que usa:
//   - consultas: la compra que alguien manda al tribunal (descripcion, monto, estado)
//       estado = 'abierta' (se puede votar), 'compro' o 'no_compro' (ya decidió)
//   - votos: lo que opina cada amigo ('a_favor' o 'en_contra' + comentario)
//   - perfiles: los nombres, para mostrar quién consulta y quién vota
// RLS hace que veas solo tus consultas y las de tus amigos ACEPTADOS.


// ----- Año en el pie y navegador que se esconde (igual que en inicio.js) -----

const anio = document.getElementById('anio');
anio.textContent = new Date().getFullYear();

const navegador = document.querySelector('.navegador');
let anterior = window.scrollY;

window.addEventListener('scroll', function () {
    const actual = window.scrollY;

    if (actual > anterior && actual > 100) {
        navegador.classList.add('oculto');
    } else {
        navegador.classList.remove('oculto');
    }

    anterior = actual;
});


// ----- Ayudas -----

// Formato de plata: 85000 → "$85.000"
function plata(numero) {
    return '$' + Number(numero).toLocaleString('es-AR');
}

// Crea una etiqueta con una clase y un texto (para no repetir 3 líneas cada vez)
function crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) {
        elemento.className = clase;
    }
    if (texto) {
        elemento.textContent = texto;   // textContent: nunca innerHTML con lo que escribe el usuario
    }
    return elemento;
}

// Un botón chico. "gris" = true para el de borrar (más suave)
function crearBoton(texto, gris) {
    const boton = crear('button', 'boton-chico', texto);
    boton.type = 'button';
    if (gris) {
        boton.className = 'boton-chico boton-chico-gris';
    }
    return boton;
}

// 'a_favor' → "👍 A favor", 'en_contra' → "👎 En contra"
function textoVoto(voto) {
    if (voto === 'a_favor') {
        return '👍 A favor';
    }
    return '👎 En contra';
}


// ----- Quién soy (se completa al arrancar) -----

let miId = '';


// ----- 1. Al abrir la página: ¿hay alguien logueado? -----

async function arrancar() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        window.location.href = 'login.html';
        return;
    }

    miId = data.session.user.id;
    cargarTodo();
}
arrancar();


// ----- 2. Traer todo y repartirlo en las dos listas -----

async function cargarTodo() {
    // Las consultas (mías y de mis amigos), de la más nueva a la más vieja
    const { data: consultas, error } = await cliente
        .from('consultas')
        .select('*')
        .order('creada', { ascending: false });

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudo cargar el tribunal. Probá de nuevo.';
        return;
    }

    // Los votos de esas consultas (RLS deja ver solo los de consultas que puedo ver)
    const { data: votos } = await cliente.from('votos').select('*');

    // Los nombres: objeto { id: nombre } para buscarlos rápido con nombres[id]
    const { data: perfiles } = await cliente.from('perfiles').select('user_id, nombre');
    const nombres = {};
    if (perfiles) {
        for (const p of perfiles) {
            nombres[p.user_id] = p.nombre;
        }
    }

    // ¿Tengo al menos un amigo aceptado? Si no, mostramos el aviso de arriba
    const { data: amigos } = await cliente
        .from('vinculos')
        .select('id')
        .eq('estado', 'aceptado');
    document.getElementById('aviso-sin-amigos').hidden = amigos && amigos.length > 0;

    const listaVotar = document.getElementById('lista-votar');
    const listaMias = document.getElementById('lista-mias');
    listaVotar.innerHTML = '';
    listaMias.innerHTML = '';

    let cantVotar = 0;
    let cantMias = 0;

    for (const c of consultas) {
        // Los votos de ESTA consulta. filter se queda solo con los que cumplen la condición
        const votosDeEsta = (votos || []).filter(function (v) {
            return v.consulta_id === c.id;
        });

        if (c.user_id === miId) {
            listaMias.appendChild(tarjetaMia(c, votosDeEsta, nombres));
            cantMias = cantMias + 1;
        } else if (c.estado === 'abierta') {
            // De un amigo y todavía se puede votar
            listaVotar.appendChild(tarjetaAmigo(c, votosDeEsta, nombres));
            cantVotar = cantVotar + 1;
        }
    }

    document.getElementById('votar-vacio').hidden = cantVotar > 0;
    document.getElementById('mias-vacio').hidden = cantMias > 0;
}


// ----- 3. Tarjeta de una compra de un AMIGO (para votar) -----

function tarjetaAmigo(c, votosDeEsta, nombres) {
    const tarjeta = crear('div', 'social-item', '');

    const quien = nombres[c.user_id] || 'Tu amigo';
    tarjeta.appendChild(crear('p', 'social-detalle', quien + ' quiere comprar:'));
    tarjeta.appendChild(crear('h3', '', c.descripcion));
    tarjeta.appendChild(crear('p', 'social-monto', plata(c.monto)));

    // ¿Ya voté? find devuelve el primero que cumple la condición (o undefined si no hay)
    const miVoto = votosDeEsta.find(function (v) {
        return v.user_id === miId;
    });

    if (miVoto) {
        // Ya voté: muestro lo que puse y un botón para cambiarlo (borra el voto y se puede votar de nuevo)
        let texto = 'Votaste ' + textoVoto(miVoto.voto);
        if (miVoto.comentario) {
            texto = texto + ': "' + miVoto.comentario + '"';
        }
        tarjeta.appendChild(crear('p', 'social-mi-voto', texto));

        const cambiar = crearBoton('Cambiar mi voto', true);
        cambiar.addEventListener('click', function () {
            borrarVoto(miVoto);
        });
        tarjeta.appendChild(cambiar);

    } else {
        // Todavía no voté: comentario opcional + los dos botones
        const comentario = crear('input', 'social-comentario', '');
        comentario.type = 'text';
        comentario.placeholder = 'Comentario (opcional): "Yo esperaría unos días"';
        comentario.setAttribute('aria-label', 'Comentario para ' + quien);
        tarjeta.appendChild(comentario);

        const acciones = crear('div', 'social-acciones', '');

        const aFavor = crearBoton('👍 Que la compre', false);
        aFavor.addEventListener('click', function () {
            votar(c, 'a_favor', comentario.value);
        });
        acciones.appendChild(aFavor);

        const enContra = crearBoton('👎 Que no la compre', false);
        enContra.addEventListener('click', function () {
            votar(c, 'en_contra', comentario.value);
        });
        acciones.appendChild(enContra);

        tarjeta.appendChild(acciones);
    }

    return tarjeta;
}


// ----- 4. Tarjeta de una compra MÍA (ver votos y decidir) -----

function tarjetaMia(c, votosDeEsta, nombres) {
    const tarjeta = crear('div', 'social-item', '');

    tarjeta.appendChild(crear('h3', '', c.descripcion));
    tarjeta.appendChild(crear('p', 'social-monto', plata(c.monto)));

    // Contar los votos de cada lado
    let aFavor = 0;
    let enContra = 0;
    for (const v of votosDeEsta) {
        if (v.voto === 'a_favor') {
            aFavor = aFavor + 1;
        } else {
            enContra = enContra + 1;
        }
    }
    tarjeta.appendChild(crear('p', 'social-cuenta',
        '👍 ' + aFavor + ' a favor · 👎 ' + enContra + ' en contra'));

    // La lista de votos con el nombre de cada amigo
    if (votosDeEsta.length === 0) {
        tarjeta.appendChild(crear('p', 'social-detalle', 'Todavía nadie votó.'));
    } else {
        const lista = crear('ul', 'social-votos', '');
        for (const v of votosDeEsta) {
            let texto = (nombres[v.user_id] || 'Un amigo') + ': ' + textoVoto(v.voto);
            if (v.comentario) {
                texto = texto + ' — "' + v.comentario + '"';
            }
            lista.appendChild(crear('li', '', texto));
        }
        tarjeta.appendChild(lista);
    }

    const acciones = crear('div', 'social-acciones', '');

    if (c.estado === 'abierta') {
        // Todavía no decidí: los dos botones
        const noCompro = crearBoton('💪 No la compro', false);
        noCompro.addEventListener('click', function () {
            decidir(c, 'no_compro');
        });
        acciones.appendChild(noCompro);

        const compro = crearBoton('La compro igual', true);
        compro.addEventListener('click', function () {
            decidir(c, 'compro');
        });
        acciones.appendChild(compro);
    } else if (c.estado === 'no_compro') {
        tarjeta.appendChild(crear('p', 'social-decision', '💪 No la compraste: sumó a tus compras evitadas.'));
    } else {
        tarjeta.appendChild(crear('p', 'social-decision', 'La compraste: se cargó como gasto en tu flujo.'));
    }

    const borrar = crearBoton('Borrar', true);
    borrar.addEventListener('click', function () {
        borrarConsulta(c);
    });
    acciones.appendChild(borrar);

    tarjeta.appendChild(acciones);
    return tarjeta;
}


// ----- 5. Mandar una compra al tribunal -----

const botonConsultar = document.getElementById('btn-consultar');

botonConsultar.addEventListener('click', async function () {
    const descripcion = document.getElementById('descripcion').value.trim();
    const monto = document.getElementById('monto').value;
    const mensaje = document.getElementById('mensaje');

    if (descripcion === '') {
        mensaje.textContent = 'Escribí qué querés comprar';
        return;
    }
    if (monto === '' || Number(monto) <= 0) {
        mensaje.textContent = 'Escribí cuánto sale';
        return;
    }

    // user_id se completa solo; estado arranca en 'abierta'
    const { error } = await cliente.from('consultas').insert({
        descripcion: descripcion,
        monto: Number(monto)
    });

    if (error) {
        mensaje.textContent = 'No se pudo mandar. Probá de nuevo.';
        return;
    }

    document.getElementById('descripcion').value = '';
    document.getElementById('monto').value = '';
    mensaje.textContent = 'Listo, tu tribunal ya puede votar. Mientras tanto… ¿y si esperás 24 horas?';
    cargarTodo();
});


// ----- 6. Votar la compra de un amigo -----

async function votar(c, voto, comentario) {
    const { error } = await cliente.from('votos').insert({
        consulta_id: c.id,
        voto: voto,
        comentario: comentario.trim()
    });

    if (error) {
        // Si el amigo ya decidió mientras tenías la página abierta, la consulta ya no está 'abierta'
        document.getElementById('mensaje').textContent = 'No se pudo votar (quizás ya decidió). Recargá la página.';
        return;
    }

    cargarTodo();
}

// Borrar mi voto (para volver a votar)
async function borrarVoto(v) {
    const { error } = await cliente.from('votos').delete().eq('id', v.id);

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudo cambiar el voto. Probá de nuevo.';
        return;
    }

    cargarTodo();
}


// ----- 7. Decidir: la compro o no la compro -----
// Además de cambiar el estado de la consulta, se carga en el flujo:
//   no la compro → movimiento 'evitado' (suma a "Compras impulsivas evitadas" del inicio)
//   la compro    → movimiento 'gasto' (resta del disponible del mes)

async function decidir(c, decision) {
    let pregunta = '¿Confirmás que NO comprás "' + c.descripcion + '"?';
    if (decision === 'compro') {
        pregunta = '¿Confirmás que comprás "' + c.descripcion + '"? Se carga como gasto en tu flujo.';
    }
    if (!confirm(pregunta)) {
        return;
    }

    const mensaje = document.getElementById('mensaje');

    // 1. Cerrar la consulta (ya nadie puede votar)
    const { error } = await cliente
        .from('consultas')
        .update({ estado: decision })
        .eq('id', c.id);

    if (error) {
        mensaje.textContent = 'No se pudo guardar tu decisión. Probá de nuevo.';
        return;
    }

    // 2. Cargarla en el flujo
    let tipo = 'evitado';
    if (decision === 'compro') {
        tipo = 'gasto';
    }

    const { error: error2 } = await cliente.from('movimientos').insert({
        tipo: tipo,
        descripcion: c.descripcion,
        categoria: 'Otros',
        monto: Number(c.monto)
    });

    if (error2) {
        mensaje.textContent = 'Se guardó tu decisión, pero no se pudo cargar en el flujo. Cargala a mano en Flujo.';
    } else if (decision === 'no_compro') {
        mensaje.textContent = '¡Bien! Te ahorraste ' + plata(c.monto) + '.';
    } else {
        mensaje.textContent = 'Listo, se cargó el gasto de ' + plata(c.monto) + ' en tu flujo.';
    }

    cargarTodo();
}


// ----- 8. Borrar una consulta mía -----
// Los votos se borran solos (on delete cascade). Lo que ya se cargó en el flujo queda.

async function borrarConsulta(c) {
    if (!confirm('¿Borrar la consulta "' + c.descripcion + '" y sus votos?')) {
        return;
    }

    const { error } = await cliente.from('consultas').delete().eq('id', c.id);

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudo borrar. Probá de nuevo.';
        return;
    }

    cargarTodo();
}


// ----- 9. Cerrar sesión -----

const botonSalir = document.getElementById('btn-salir');

botonSalir.addEventListener('click', async function () {
    await cliente.auth.signOut();
    window.location.href = 'index.html';
});
